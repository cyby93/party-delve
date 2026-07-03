---
baseline_commit: eab380d
---

# Story 5.6: Mobile Bond Card & Continue UX

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.6)
Context: Stories 5.1–5.5 done.
  Existing contracts (DO NOT change):
    - packages/net-protocol/src/messages/server-to-mobile.ts:
        BondNotificationMsg { type: 'bond:notification', playerA, playerB, bondType, bondColor, bondDescription, bondMechanic }
    - packages/net-protocol/src/messages/mobile-to-server.ts:
        ContinueMsg { type: 'bond:continue' }
    - packages/net-protocol/src/event-names.ts:
        EventNames.BOND_NOTIFICATION = 'bond:notification'  ← unicast channel to bonded players
        EventNames.CONTINUE = 'bond:continue'               ← mobile sends this to advance
        EventNames.DELTA = 'delta'                          ← broadcast channel; bond:assigned arrives here (all mobiles)
    - packages/shared-types/src/bond.ts:
        BondType { Proximity='proximity', Fate='fate' }
    - apps/mobile-controller/src/session/mobile-session.ts:
        MobileSession interface — needs sendContinue added
        wireRoomHandlers — needs BOND_NOTIFICATION channel wired
    - apps/mobile-controller/src/App.tsx:
        handleDelta — already processes bond:assigned via applyDelta; add inBondMoment trigger
        PostRunMobileScreen check at line ~222 — before ControllerScreen return; bond card never shows in post-run
    - apps/mobile-controller/src/screens/ControllerScreen.tsx:
        ControllerScreen({ session, gameState, cooldowns }) — needs bondNotification, inBondMoment, onContinue props
        InteractButton component — needs to support "Continue" label variant
  Server behaviour (read-only context):
    - Server sends bond:notification unicast to playerA and playerB only (GameRoom.ts:712)
    - Server broadcasts bond:assigned delta to ALL clients including host (GameRoom.ts:693)
    - Server records bondMomentNextLevel and waits for any client to send bond:continue (GameRoom.ts:257)
    - On bond:continue: server calls loadLevel(nextLevel) and broadcasts a full snapshot (GameRoom.ts:262)
    - bondMomentNextLevel reset to -1 after first CONTINUE received — subsequent CONTINUEs are no-ops
  Key invariants:
    - bond:assigned delta arrives on ALL mobile clients via EventNames.DELTA — use this to set inBondMoment=true
    - bond:notification unicast arrives ONLY on the two bonded players' mobiles — use this to show BondCard
    - Non-bonded players never receive bond:notification; they only get bond:assigned delta
    - Bond moment ends when server broadcasts snapshot with incremented currentLevel (after CONTINUE)
    - Any one player sending CONTINUE is sufficient — group advances
    - BondCard mandatory read delay: 1.5s before Continue button becomes tappable
    - PostRunMobileScreen check in App.tsx at line ~222 renders before ControllerScreen — BondCard never shown in post-run
    - touch targets must be ≥44×44px (NFR5)
Owner agent: Mobile Controller Engineer
  (single ownership — all changes in apps/mobile-controller/**)
Goal: During a Spirit Bond moment:
  (1) Bonded players see their controller replaced by a full-screen bond-card with bond name,
      personal description, mechanic summary, and a Continue button active after ~1.5s.
  (2) Non-bonded players see their controller remain visible but skill cells inactive,
      plus an interact-button in "Continue" variant sliding in from the top (immediately tappable).
  (3) Any player (bonded or non-bonded) tapping Continue sends ContinueMsg to the server,
      which advances the group to the next level — all phones transition back to the standard controller.
Allowed paths:
  - apps/mobile-controller/src/session/mobile-session.ts  (MODIFY — wire BOND_NOTIFICATION, add sendContinue)
  - apps/mobile-controller/src/App.tsx                    (MODIFY — bond moment state, pass props)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (MODIFY — BondCard, Continue variant, disable skills)
Blocked paths:
  - packages/shared-types/**         (5.1 contracts final)
  - packages/net-protocol/**         (BondNotificationMsg + ContinueMsg already correct — no changes needed)
  - packages/game-rules/**           (sim-only)
  - apps/host-client/**              (5.5 scope — done)
  - apps/simulation-server/**        (sim-only)
Inputs:
  - packages/net-protocol/src/messages/server-to-mobile.ts  — BondNotificationMsg shape
  - packages/net-protocol/src/messages/mobile-to-server.ts  — ContinueMsg shape
  - packages/net-protocol/src/event-names.ts                — EventNames.BOND_NOTIFICATION, CONTINUE, DELTA
  - packages/net-protocol/src/index.ts                      — exports to confirm (ContinueMsg, BondNotificationMsg)
  - apps/mobile-controller/src/session/mobile-session.ts    — full file (wireRoomHandlers, MobileSession, joinSession, reconnectToSession)
  - apps/mobile-controller/src/App.tsx                      — full file (handleDelta, screen routing, ControllerScreen props)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx — full file (InteractButton, SkillCell, ControllerScreen)
  - packages/ui-kit/src/tokens.css                          — CSS custom properties
  - Epic 5 Story 5.6 acceptance criteria (epics.md lines 1145–1176)
  - UX DESIGN.md lines 438–455 — bond-card anatomy and states
  - UX EXPERIENCE.md lines 161–174 — bond-card behaviour, bonded vs non-bonded paths
Non-goals:
  - Bond audio (out of scope for alpha)
  - Bond icon graphic (spec marks it TBD; skip in 5.6)
  - Multiple bonds on the same player in one bond-moment (each bond-moment is one bond only)
  - Server-side bond-moment gating (already implemented in GameRoom.ts)
Acceptance criteria:
  AC1 (bonded player — bond-card):
    Given: mobile receives BondNotificationMsg on EventNames.BOND_NOTIFICATION
    When: bond-card renders
    Then: full-screen bg-base overlay with inset bond-color frame glow
    And: bond name (e.g., "Proximity Bond") in Uncial Antiqua 28px, text-primary, centered
    And: bond description from BondNotificationMsg.bondDescription in Lora 400 italic base, text-secondary, centered
    And: bond mechanic from BondNotificationMsg.bondMechanic in Lora 700 sm, text-primary, centered
    And: Continue button present but inactive (opacity 0.3, pointer-events none) for first ~1.5s
    And: Continue button becomes active (opacity 1, pointer-events auto) after ~1.5s
  AC2 (non-bonded player — continue slide-in):
    Given: mobile receives bond:assigned delta but NOT a BondNotificationMsg (non-bonded player)
    When: bond moment begins
    Then: controller layout remains visible
    And: all 4 skill cells are non-interactive (no touch response)
    And: interact-button appears with label "Continue" (slides in from top, immediately tappable — no 1.5s delay)
  AC3 (advance trigger):
    Given: any player (bonded or non-bonded) taps Continue
    When: server receives ContinueMsg
    Then: server broadcasts snapshot with next level
    And: bond-card and continue overlay both dismiss (inBondMoment clears when currentLevel advances)
    And: controller returns to standard interactive state
  AC4 (touch targets):
    Given: bond-card Continue button
    When: rendered
    Then: minimum 44px height
  AC5 (bond name derivation):
    Given: BondNotificationMsg.bondType is 'fate' or 'proximity'
    When: bond-card renders
    Then: 'fate' → "Fate Bond"; 'proximity' → "Proximity Bond"
Required hooks:
  - Mobile-UX hook (modifying mobile controller UI)
    Mobile checks:
      - BondCard readable and not cut off on portrait phone
      - Continue button 44px touch target
      - Frame glow visible
      - Non-bonded controller skill cells visually inactive
      - Sliding Continue button visible and immediately tappable
      - Standard controller resumes after Continue
Required tests: None beyond manual smoke (purely UX/visual; no game logic)
Telemetry impact: None
```

## Story

As a player during a bond assignment moment,
I want my phone to either show me a detailed bond card (if I'm bonded) or a simple Continue button (if I'm not),
so that bonded players can read their bond terms before we advance to the next level.

## Acceptance Criteria

1. **AC1 — Bonded player bond-card**
   - **Given** a player's mobile receives a `BondNotificationMsg` (they are in the newly assigned bond)
   - **When** the bond moment begins
   - **Then** the controller disappears and is replaced by a full-screen `bond-card` component
   - **And** the card shows: bond name (Uncial Antiqua `lg` 28px, text-primary), bond description (Lora 400 italic base, text-secondary), and bond mechanic summary (Lora 700 sm, text-primary)
   - **And** the phone frame is wrapped in the bond's color as a CSS inset `box-shadow` on the full-screen container
   - **And** the Continue button appears after a ~1.5s mandatory read delay (transitions to `dismiss-ready` state)

2. **AC2 — Non-bonded player continue UX**
   - **Given** a player's mobile does NOT receive a `BondNotificationMsg` (they are not bonded)
   - **When** the bond moment begins (they received the `bond:assigned` delta)
   - **Then** the controller layout remains visible but all 4 skill cells are inactive (non-interactive)
   - **And** the `interact-button` in `continue` variant slides in from the top with label "Continue"
   - **And** it is immediately tappable (no mandatory delay)

3. **AC3 — Advance trigger**
   - **Given** any player (bonded or non-bonded) taps Continue
   - **When** the server receives the `ContinueMsg`
   - **Then** all phones transition back to the standard in-combat controller layout
   - **And** the bond-card and continue overlay dismiss simultaneously on all phones (driven by currentLevel advancing in the snapshot)

4. **AC4 — Touch targets**
   - **Given** the bond-card Continue button
   - **When** rendered
   - **Then** minimum 44px height met

5. **AC5 — Bond name**
   - **Given** `BondNotificationMsg.bondType === 'fate'`
   - **When** bond-card renders
   - **Then** bond name is "Fate Bond"; for `'proximity'` it is "Proximity Bond"

## Tasks / Subtasks

- [x] Task 1: Wire `bond:notification` channel in `mobile-session.ts` (AC: 1, 2, 3)
  - [x] 1.1 Add `onBondNotification: (msg: BondNotificationMsg) => void` parameter to `wireRoomHandlers`
  - [x] 1.2 Add `room.onMessage(EventNames.BOND_NOTIFICATION, ...)` handler inside `wireRoomHandlers` (same decode pattern as COOLDOWN_UPDATE)
  - [x] 1.3 Add `sendContinue: () => void` to the `MobileSession` interface
  - [x] 1.4 Add `sendContinue: () => room.send(EventNames.CONTINUE, { type: 'bond:continue' } satisfies ContinueMsg)` to both `joinSession` and `reconnectToSession` return objects
  - [x] 1.5 Add `BondNotificationMsg` and `ContinueMsg` to imports from `'net-protocol'`
  - [x] 1.6 Pass `onBondNotification` as a required parameter to `joinSession` and `reconnectToSession` (real handler wired in Task 2.9 simultaneously)

- [x] Task 2: Add bond moment state to `App.tsx` (AC: 1, 2, 3)
  - [x] 2.1 Add `bondNotification` state: `useState<BondNotificationMsg | null>(null)`
  - [x] 2.2 Add `inBondMoment` state: `useState(false)`
  - [x] 2.3 Add `bondMomentLevelRef = useRef<number | null>(null)` and `gameStateRef = useRef<GameState | null>(null)`
  - [x] 2.4 Add `useEffect(() => { gameStateRef.current = gameState; }, [gameState])` to keep ref in sync
  - [x] 2.5 In `handleDelta`, add `bond:assigned` case (uses `session.levelIndex` — actual field name on SessionState)
  - [x] 2.6 In `handleDelta`, clear bond moment on run:complete and run:failed
  - [x] 2.7 Add `handleBondNotification = useCallback((msg: BondNotificationMsg) => { setBondNotification(msg); }, [])`
  - [x] 2.8 Add useEffect to clear bond moment when `levelIndex` advances
  - [x] 2.9 Pass `onBondNotification={handleBondNotification}` to `joinSession` and `reconnectToSession` calls
  - [x] 2.10 Add `handleContinue = useCallback(() => { sessionRef.current?.sendContinue(); }, [])`
  - [x] 2.11 Pass `bondNotification`, `inBondMoment`, and `onContinue={handleContinue}` to `ControllerScreen`
  - [x] 2.12 Add `BondNotificationMsg` to imports from `'net-protocol'`

- [x] Task 3: Add BondCard and Continue variant to `ControllerScreen.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Add `label?: string` prop to `InteractButtonProps` (default `"Interact"`) and use it in the span; update existing usages to keep them working
  - [x] 3.2 Add `bondNotification: BondNotificationMsg | null`, `inBondMoment: boolean`, `onContinue: () => void` props to `ControllerScreen`
  - [x] 3.3 In `ControllerScreen`, derive `bondedPartnerId`, `partnerName`, `bondName`
  - [x] 3.4 In the skill cell `isInteractive` computation, add `&& !inBondMoment` to force cells inactive during bond moment for non-bonded players
  - [x] 3.5 Updated `InteractButton` render: `visible={activePoi !== null || (inBondMoment && bondNotification === null)}`, `label` and `onTap` with Continue path
  - [x] 3.6 Add `BondCard` component above `ControllerScreen` (zIndex 70, inset box-shadow frame glow, 1.5s dismiss timer)
  - [x] 3.7 Render `BondCard` inside `ControllerScreen` return JSX as last child
  - [x] 3.8 Add `BondNotificationMsg` to imports from `'net-protocol'` in ControllerScreen.tsx

## Dev Notes

### Bond Moment Flow — Two Separate Channels

The server sends two distinct messages when a bond is assigned:

1. **`EventNames.DELTA` (`bond:assigned`)** — broadcast to ALL connected clients (host + all mobiles)
   - Mobile currently processes this via `applyDelta` which updates `gameState.activeBonds`
   - Story 5.6 ALSO uses this arrival to set `inBondMoment = true` on ALL mobile clients
   - Non-bonded players enter bond moment via this delta only

2. **`EventNames.BOND_NOTIFICATION`** — unicast to `playerA` and `playerB` ONLY (bonded pair)
   - Carries: bondDescription, bondMechanic, bondColor, playerA/B IDs, bondType
   - Bonded players get both the delta (AC2-path skipped for them) and this unicast (AC1-path)
   - Currently NOT wired in `wireRoomHandlers` — this is Task 1's main work

### BOND_NOTIFICATION is not in DeltaEventMsg

`bond:notification` is NOT part of the `DeltaEventMsg` union — it is a separate server-to-mobile type with its own channel (`EventNames.BOND_NOTIFICATION`). It is handled via a separate `room.onMessage` call, NOT inside the `onDelta` callback.

Do NOT add it to the `handleDelta` flow in App.tsx — it has its own `handleBondNotification` callback.

### Detecting Bond Moment End — Level Advance Pattern

The server calls `loadLevel(nextLevel)` on CONTINUE and broadcasts a new snapshot. This increments `gameState.session.currentLevel`. The mobile detects bond moment end via:

```typescript
useEffect(() => {
  if (!inBondMoment || bondMomentLevelRef.current === null) return;
  const level = gameState?.session.currentLevel;
  if (level !== undefined && level !== bondMomentLevelRef.current) {
    setInBondMoment(false);
    setBondNotification(null);
    bondMomentLevelRef.current = null;
  }
}, [gameState?.session.currentLevel, inBondMoment]);
```

`bondMomentLevelRef` captures the level at which `bond:assigned` arrived. When the level changes (snapshot after CONTINUE), both `inBondMoment` and `bondNotification` clear.

### Why `gameStateRef` is Needed in App.tsx

`handleDelta` is a `useCallback` with no deps (relies on `sessionRef` pattern for stale closure avoidance). To read `gameState.session.currentLevel` inside `handleDelta` when `bond:assigned` arrives, we need a `gameStateRef`. Add:

```typescript
const gameStateRef = useRef<GameState | null>(null);
useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
```

Then in `handleDelta`:
```typescript
if (delta.type === 'bond:assigned') {
  bondMomentLevelRef.current = gameStateRef.current?.session.currentLevel ?? null;
  setInBondMoment(true);
}
```

This mirrors the existing `sessionRef` pattern used throughout App.tsx.

### InteractButton Label Prop — Minimal Change

The existing `InteractButton` always shows "Interact". Add `label?: string` with default `"Interact"`:

```typescript
interface InteractButtonProps {
  visible: boolean;
  onTap: () => void;
  label?: string;  // ← add
}

function InteractButton({ visible, onTap, label = 'Interact' }: InteractButtonProps) {
  // ...
  <span ...>{label}</span>  // replace hardcoded "Interact"
}
```

Existing call site (`onTap` for POI) passes no `label` — defaults to "Interact". Bond moment call site passes `label="Continue"`. No existing behavior changes.

### Non-Bonded Controller: Skill Cell Inactive During Bond Moment

The `isInteractive` computation in the skill cells map (~line 1228) currently:

```typescript
const isInteractive = isSpiritCell
  ? !isOnCooldown && !isFrozen
  : (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown;
```

Add `&& !inBondMoment` to the non-spirit-cell branch:

```typescript
const isInteractive = isSpiritCell
  ? !isOnCooldown && !isFrozen
  : (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown && !inBondMoment;
```

This makes all 4 cells non-interactive for non-bonded players during bond moment. The visual dimming is NOT required by AC (cells just become non-interactive) — but you can add `opacity: 0.5` on the cell if desired.

### BondCard Frame Glow — Inset Box-Shadow Approach

The UX spec says "bond-color glow wraps the physical phone frame (CSS `outline` or `box-shadow` on the root element)." Since touching `document.body` from a component is fragile, use an inset box-shadow on the BondCard's full-screen container:

```css
box-shadow: inset 0 0 0 6px {bondColor}, inset 0 0 40px {bondColor}40
```

`{bondColor}40` = 25% opacity of the bond color (hex alpha). This creates a 6px solid colored border at screen edges plus a diffuse glow inward, achieving the same visual effect.

`bondNotification.bondColor` is a CSS hex string like `'#6ea8d8'` or `'#f5a623'` — use it directly in CSS (it's already a valid CSS color value, unlike in PixiJS where parseInt is needed).

### BondCard Description — Personal Address with Partner Name

The `bondDescription` from the server is: 
- proximity: `'Your spirits entwine — drawing power from closeness, but paying a toll when you linger.'`
- fate: `'Your fates are now bound. What befalls one, befalls the other.'`

Prepend `"You and {partnerName} — "` to include the partner's name:

```typescript
`You and ${partnerName} — ${bondNotification.bondDescription}`
```

This fulfills the "direct personal address" UX requirement without server changes.

`partnerName` = `gameState?.players.find(p => p.id === bondedPartnerId)?.displayName ?? 'your partner'`

### BondCard Continue Button vs InteractButton

The InteractButton slides from the top (position: absolute, top 0, translateY animation). Inside BondCard, the Continue button is inline (position: static, below the mechanic text). These are structurally different — do NOT reuse `InteractButton` inside `BondCard`. The BondCard has its own inline `<button>` element with the same visual styling (bg-surface → interactive, accent-spirit border, Lora 700 md).

### BondCard `dismissReady` — useState + useEffect Pattern

Mirrors the Story 5.5 overlay timer pattern (which used useRef'd timeouts). Here we use a simpler `useState(false)` + `useEffect` with `setTimeout(1500)`:

```typescript
const [dismissReady, setDismissReady] = useState(false);
useEffect(() => {
  const t = setTimeout(() => setDismissReady(true), 1500);
  return () => clearTimeout(t);
}, []); // ← empty dep array: timer starts on mount, fires once
```

On mount = when bond-card appears. Cleanup prevents timer firing if bond-card unmounts before 1.5s (e.g., if CONTINUE arrived very fast from another player).

### Continue Flow for Bonded Player

The bonded player who taps Continue inside BondCard calls `onContinue()` → `sessionRef.current?.sendContinue()` → `room.send(EventNames.CONTINUE, { type: 'bond:continue' })`. The server processes CONTINUE, broadcasts the next level snapshot, all mobiles detect `currentLevel` change and clear the bond moment.

### Continue Flow for Non-Bonded Player

The non-bonded player taps `InteractButton` with label "Continue" (slides from top). `onTap` calls `onContinue()` → same path. This is the first CONTINUE to arrive; server's `bondMomentNextLevel` resets to -1 and subsequent CONTINUEs are no-ops.

### InteractButton `onTap` for Bond Moment

In the existing `InteractButton` render in ControllerScreen (~line 1115–1122):

```typescript
<InteractButton
  visible={activePoi !== null}
  onTap={() => {
    if (activePoi === 'class-select') setClassSelectionOpen(true);
    if (activePoi === 'training-dummy' && confirmedClass !== null) setTrainingDummyActive(true);
    if (activePoi === 'dungeon-entrance') setDungeonEntranceOpen(true);
  }}
/>
```

Update to:

```typescript
<InteractButton
  visible={activePoi !== null || (inBondMoment && bondNotification === null)}
  label={inBondMoment && bondNotification === null ? 'Continue' : 'Interact'}
  onTap={() => {
    if (inBondMoment && bondNotification === null) { onContinue(); return; }
    if (activePoi === 'class-select') setClassSelectionOpen(true);
    if (activePoi === 'training-dummy' && confirmedClass !== null) setTrainingDummyActive(true);
    if (activePoi === 'dungeon-entrance') setDungeonEntranceOpen(true);
  }}
/>
```

The `return` after `onContinue()` prevents POI actions from also firing.

### MobileSession Interface — Import Updates

`mobile-session.ts` currently imports:
```typescript
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, ClassSelectMsg, CooldownUpdateMsg, RunProposeMsg, VoteMsg, ReturnToCampMsg } from 'net-protocol';
```

Add `BondNotificationMsg, ContinueMsg`:
```typescript
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, ClassSelectMsg, CooldownUpdateMsg, BondNotificationMsg, RunProposeMsg, VoteMsg, ReturnToCampMsg, ContinueMsg } from 'net-protocol';
```

Both are already exported from `packages/net-protocol/src/index.ts`:
```
export type { ..., BondNotificationMsg, ... } from './messages/server-to-mobile.js';
export type { ..., ContinueMsg } from './messages/mobile-to-server.js';
```

### BondCard z-index

The existing full-screen overlays in ControllerScreen use:
- `VotePopup`: zIndex 60
- `ClassSelectionScreen`: zIndex 50
- `DungeonEntranceScreen`: zIndex 50

BondCard uses `zIndex: 70` to sit above VotePopup. This ensures the bond card is never blocked by a concurrent vote (which shouldn't happen in practice since bond-moments only occur between dungeon levels, not during voting flows, but defense-in-depth).

### What Stays the Same

- No changes to `packages/net-protocol`, `packages/shared-types`, `packages/game-rules`
- No changes to `apps/simulation-server`
- No changes to `apps/host-client`
- `applyDelta` already handles `bond:assigned` → updates `gameState.activeBonds` on mobile too; no change needed
- PostRunMobileScreen check at App.tsx line ~222 renders before ControllerScreen — BondCard never shown post-run; no special handling needed
- The existing spirit-form and downed overlays in ControllerScreen are unaffected; `inBondMoment` is a separate axis

### Files to Modify

1. `apps/mobile-controller/src/session/mobile-session.ts` — wire BOND_NOTIFICATION, add sendContinue
2. `apps/mobile-controller/src/App.tsx` — bond moment state, handleBondNotification, level-change effect
3. `apps/mobile-controller/src/screens/ControllerScreen.tsx` — BondCard component, label prop, inBondMoment disable, Continue variant

### Project Context Rules

**Authority model**: Mobile sends input events only. `ContinueMsg` is the mobile input event for advancing. Server mutates game state; mobile reacts to snapshot.

**No game-rules import**: Do NOT import `BOND_DESCRIPTIONS`, `BOND_MECHANICS`, or `BOND_TYPE_COLORS` from `game-rules` — all bond content arrives in `BondNotificationMsg` already. The bond name ("Proximity Bond" / "Fate Bond") is derived inline from `bondType`.

**No Math.random()**: Not applicable here.

**Event contract discipline**: Bond notification arrives on `EventNames.BOND_NOTIFICATION` — a separate Colyseus channel, not DELTA. The advance is sent on `EventNames.CONTINUE`. Wire them correctly; do not conflate with the DELTA channel.

**Serialization**: All `room.onMessage` callbacks use the existing `decode<T>()` helper (line 28 of mobile-session.ts) — handles both plain objects and JSON strings defensively.

**Touch targets**: Continue button in BondCard must be `minHeight: 48` (≥44px NFR). InteractButton already meets this (existing `minHeight: 44`).

**CSS tokens**: All colors via tokens. Exception: `bondNotification.bondColor` is used directly for the frame glow and Continue button border in dismiss state — this is dynamic per-bond color from the server, not a design token.

**Fonts**: Mobile has `@ui-kit/tokens.css` imported in `main.tsx` — `var(--font-display)` (Uncial Antiqua) and `var(--font-body)` (Lora) are available. No additional font imports needed.

### References

- [Source: packages/net-protocol/src/messages/server-to-mobile.ts — BondNotificationMsg shape]
- [Source: packages/net-protocol/src/messages/mobile-to-server.ts — ContinueMsg shape]
- [Source: packages/net-protocol/src/event-names.ts — EventNames.BOND_NOTIFICATION, CONTINUE, DELTA]
- [Source: packages/net-protocol/src/index.ts — confirms BondNotificationMsg, ContinueMsg exports]
- [Source: apps/mobile-controller/src/session/mobile-session.ts — wireRoomHandlers, MobileSession interface, joinSession, reconnectToSession]
- [Source: apps/mobile-controller/src/App.tsx — handleDelta, screen routing, sessionRef pattern]
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:27–63 — InteractButton component]
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:596–875 — SkillCell component and isInteractive logic]
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:888–1292 — ControllerScreen component]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:257–264 — CONTINUE handler and level loading]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:700–712 — BondNotificationMsg construction and unicast]
- [Source: packages/game-rules/src/balance.ts:106–113 — BOND_DESCRIPTIONS and BOND_MECHANICS (server sends these; mobile receives via BondNotificationMsg)]
- [Source: _bmad-output/planning-artifacts/epics.md lines 1145–1176 — Story 5.6 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md lines 438–455 — bond-card anatomy and states]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md lines 161–174 — bond-card behaviour, bonded vs non-bonded paths]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md lines 269–280 — between-level bond moment state description]
- [Source: _bmad-output/implementation-artifacts/5-5-host-bond-visualization-assignment-overlay-and-particle-tethers.md — prior story; dev notes on bond:assigned timing]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Fixed `currentLevel` → `levelIndex` (actual `SessionState` field). Moved `handleBondNotification` declaration before `handleJoin`/`handleReconnect` to resolve forward-reference TS errors.

### Completion Notes List

- Task 1: `mobile-session.ts` — wired `BOND_NOTIFICATION` channel via `room.onMessage`, added `sendContinue` to `MobileSession` interface and both return objects, added `onBondNotification` param to `wireRoomHandlers`/`joinSession`/`reconnectToSession`.
- Task 2: `App.tsx` — added `bondNotification` + `inBondMoment` state, `gameStateRef` + `bondMomentLevelRef` refs, `handleBondNotification` callback, level-advance `useEffect` (keyed on `session.levelIndex`), `handleContinue` callback, passed all to `ControllerScreen`.
- Task 3: `ControllerScreen.tsx` — added `label` prop to `InteractButton` (default `'Interact'`), added `BondCard` component (zIndex 70, inset frame glow, 1.5s dismiss timer), updated `ControllerScreen` props and renders BondCard + Continue InteractButton variant for non-bonded path, disabled skill cells during bond moment via `&& !inBondMoment`.

### File List

- apps/mobile-controller/src/session/mobile-session.ts
- apps/mobile-controller/src/App.tsx
- apps/mobile-controller/src/screens/ControllerScreen.tsx

### Review Findings

- [x] [Review][Patch] AC2 violation: spirit cell (isSpiritCell branch) not disabled during bond moment — add `&& !inBondMoment` to the isSpiritCell isInteractive branch [apps/mobile-controller/src/screens/ControllerScreen.tsx:1297]
- [x] [Review][Patch] handleReconnect leaves inBondMoment/bondNotification/bondMomentLevelRef dirty — add explicit reset after setSession(s) so reconnect mid-bond-moment doesn't leave skill cells locked [apps/mobile-controller/src/App.tsx:176]
- [x] [Review][Patch] AC1 minor: fontWeight missing on bond description span — spec requires Lora 400 italic; all other styled spans set fontWeight explicitly [apps/mobile-controller/src/screens/ControllerScreen.tsx:906]
- [x] [Review][Defer] room.reconnection.enabled = false silent no-op (Colyseus SDK has no such property) [apps/mobile-controller/src/session/mobile-session.ts:99] — deferred, pre-existing
- [x] [Review][Defer] reconnectToSession loses token refresh if sessionStorage was cleared between disconnect and reconnect [apps/mobile-controller/src/session/mobile-session.ts:153] — deferred, pre-existing
- [x] [Review][Defer] Own player isFrozen/isReconnected flags never applied locally due to early-return on own player:disconnected delta [apps/mobile-controller/src/App.tsx:105] — deferred, pre-existing
- [x] [Review][Defer] handleJoin re-throws join errors with no caller error boundary in App.tsx [apps/mobile-controller/src/App.tsx:152] — deferred, pre-existing
- [x] [Review][Defer] sessionRef.current is null during the window between wireRoomHandlers and setSession(s) [apps/mobile-controller/src/session/mobile-session.ts:119] — deferred, pre-existing

### Change Log

| Date | Change |
|------|--------|
| 2026-07-03 | Story 5.6 created; ready-for-dev |
| 2026-07-03 | Implemented all tasks; typecheck clean; status → review |
| 2026-07-03 | Code review (ultra); 3 patches applied, 5 deferred, 10 dismissed → status → done |

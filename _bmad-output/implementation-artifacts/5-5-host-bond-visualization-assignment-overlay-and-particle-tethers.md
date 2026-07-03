---
baseline_commit: 3ba3199
---

# Story 5.5: Host Bond Visualization — Assignment Overlay & Particle Tethers

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.5)
Context: Stories 5.1–5.4 done.
  Existing contracts (DO NOT change):
    - packages/shared-types/src/bond.ts:
        BondType { Proximity='proximity', Fate='fate' }
        BondState { playerA: string, playerB: string, type: BondType, color: string }
    - packages/net-protocol/src/messages/server-to-host.ts:
        BondAssignedDelta { type: 'bond:assigned', playerA, playerB, bondType, bondColor }
        Already in DeltaEventMsg union — DO NOT modify net-protocol
    - packages/net-protocol/src/event-names.ts:
        EventNames.DELTA — the channel bond:assigned arrives on (server broadcasts it)
        EventNames.SNAPSHOT — full state sync channel
    - apps/host-client/src/session/host-session.ts:
        onTransientDelta filter at line ~45 — bond:assigned NOT yet included; add it
        bond:assigned already passes through applyDelta and reaches gameState.activeBonds
    - apps/host-client/src/screens/DungeonScreen.tsx:
        renderFrame(state, app, playerGraphics, enemyGraphics, essenceFlashes) — add tetherGraphics param
        PlayerChipHUD({ player }) component — add bondColors: string[] prop
        levelClearFlash useEffect at line ~246 handles level:complete already
        latestTransientDelta useEffect at line ~242 — add bond:assigned case here
  Key invariants:
    - gameState.activeBonds accumulates during a run (1 after level 1, 2 after level 2, 3 after level 3)
    - activeBonds is reset to [] by resetToHub between runs
    - BondState.color is a CSS hex string like '#6ea8d8' — need parseInt(color.slice(1), 16) for PixiJS numbers
    - BondAssignedDelta.playerA / playerB are player IDs — look up displayName from gameState.players
    - PixiJS 8 line API: g.moveTo(x1,y1).lineTo(x2,y2).stroke({ color: number, width: number, alpha: number })
    - app.stage.addChildAt(g, 0) inserts at the BOTTOM of render stack — tethers go below players/enemies
    - CSS tokens: var(--text-xl)=40px, var(--font-display)='Uncial Antiqua', var(--accent-spirit)=#6ea8d8
    - App.tsx clears latestTransientDelta after 400ms — bond overlay must use local state with its own 3s timer
    - level:complete and bond:assigned may arrive in same WS frame; React 18 batches both
      setLatestTransientDelta calls; DungeonScreen may only see the last one (bond:assigned).
      This is pre-existing design debt — levelClearFlash may be skipped when followed by bond-moment.
      Do NOT fix this in 5.5; note it as deferred.
Owner agent: Host Experience Engineer
  (single ownership — all changes in apps/host-client/**)
Goal: When a BondAssignedDelta arrives at the host client:
  (1) Show a floating text overlay "{nameA} · {nameB} — {BondLabel} Bond" in Uncial Antiqua xl,
      accent-spirit glow, no panel, fades out after ~3 seconds.
  (2) Draw a colored particle tether line in the PixiJS canvas between the bonded pair's current
      positions; tether updates every frame and persists for the rest of the run.
  (3) Show a small colored bond dot in each bonded player's chip in the top HUD strip.
Allowed paths:
  - apps/host-client/src/session/host-session.ts   (MODIFY — add bond:assigned to transient filter)
  - apps/host-client/src/screens/DungeonScreen.tsx (MODIFY — overlay, tethers, chip dots)
Blocked paths:
  - packages/shared-types/**         (5.1 contracts final)
  - packages/net-protocol/**         (BondAssignedDelta already correct — no changes needed)
  - packages/game-rules/**           (sim-only; never import in host-client)
  - apps/mobile-controller/**        (story 5.6 scope)
  - apps/simulation-server/**        (sim-only)
Inputs:
  - packages/net-protocol/src/messages/server-to-host.ts — BondAssignedDelta shape
  - packages/shared-types/src/bond.ts — BondState shape
  - apps/host-client/src/session/host-session.ts — transient delta filter (lines ~41–59)
  - apps/host-client/src/screens/DungeonScreen.tsx — full file (renderFrame, PlayerChipHUD, useEffects)
  - packages/ui-kit/src/tokens.css — CSS custom properties for design tokens
  - apps/host-client/index.html — confirms Uncial Antiqua font loaded via Google Fonts
  - Epic 5 Story 5.5 acceptance criteria (epics.md lines 1112–1144)
  - UX DESIGN.md lines 295–300, EXPERIENCE.md lines 273–289 — bond overlay visual spec
Non-goals:
  - Mobile bond card / Continue UX (story 5.6)
  - Bond audio (out of scope for alpha — wire in Epic 10 polish)
  - Fixing level:complete / bond:assigned same-batch React batching (pre-existing, deferred)
  - Bond-moment "bond-price-active" visual indicator (no AC for it in 5.5)
  - Boss-level tether extra styling (same tether code handles all 3 bonds already)
Acceptance criteria:
  AC1: BondAssignedDelta → overlay text "{nameA} · {nameB} — {BondLabel} Bond" appears centered,
       Uncial Antiqua, var(--text-xl) (40px), text-shadow: 0 0 40px rgba(110,168,216,0.7),
       no panel/border/background; fades out after ~3 seconds
  AC2: When PixiJS ticker runs after bond-moment, a line is drawn between bonded players' canvas
       positions in bond.color; tether updates every frame; persists until run resets
  AC3: Multiple bonds render simultaneous tethers (up to 3 by level 3)
  AC4: Tethers render below player sprites (z-order via addChildAt(g, 0))
  AC5: Each player chip in the top HUD strip shows a small colored dot for each bond that player
       participates in; dot color matches the bond tether color
Required hooks:
  - Client-UX hook (modifying host UI)
    Host checks:
      - Bond overlay visible and readable at couch distance (24px minimum met by --text-xl 40px)
      - Tether visible in PixiJS canvas
      - Player chip dots visible
      - No regression in existing chip HP pips, spirit glow, frozen state display
Required tests: None beyond manual smoke (purely visual; no game logic changes)
Telemetry impact: None
```

## Story

As a group watching the host screen,
I want to see a dramatic bond assignment announcement and colored particle tethers connecting bonded players,
so that everyone can immediately see which players are bonded and what's at stake.

## Acceptance Criteria

1. **AC1 — Bond assignment overlay**
   - **Given** the host client receives a `BondAssignedDelta` on the `EventNames.DELTA` channel
   - **When** the overlay renders
   - **Then** it shows `"{nameA} · {nameB} — {BondLabel} Bond"` (nameA/nameB are display names from `gameState.players`; BondLabel is "Proximity" or "Fate" capitalized)
   - **And** the text uses `font-family: var(--font-display)` (Uncial Antiqua), `font-size: var(--text-xl)` (40px)
   - **And** the text has `text-shadow: 0 0 40px rgba(110,168,216,0.7)`, `color: var(--accent-spirit)`
   - **And** no panel, border, or background frame is drawn — text floats over the live canvas
   - **And** the overlay fades out after ~3 seconds using `opacity` transition

2. **AC2 — Particle tether line in PixiJS canvas**
   - **Given** a `BondAssignedDelta` has been received (bond is in `gameState.activeBonds`)
   - **When** the PixiJS ticker fires `renderFrame` each frame
   - **Then** a line is drawn between bonded players' current canvas positions in the bond's `color`
   - **And** tether updates position every frame as players move
   - **And** tether persists for the remainder of the run (does not fade)

3. **AC3 — Multiple tethers**
   - **Given** multiple bonds accumulate (1 after level 1, 2 after level 2, 3 after level 3)
   - **When** the host canvas renders
   - **Then** each active bond renders its own distinct-colored tether simultaneously

4. **AC4 — Tether z-order**
   - **Given** tether Graphics objects are added to the PixiJS stage
   - **When** `app.stage.addChildAt(g, 0)` is used
   - **Then** tethers render below player and enemy sprites

5. **AC5 — Player chip bond dots**
   - **Given** the player chip component in the top strip
   - **When** a player participates in one or more active bonds
   - **Then** a small colored dot (8×8px) appears in the chip for each bond
   - **And** the dot color matches the corresponding tether/bond color

## Tasks / Subtasks

- [x] Task 1: Add `bond:assigned` to transient delta filter in `host-session.ts` (AC: 1)
  - [x] 1.1 In `apps/host-client/src/session/host-session.ts`, add `delta.type === 'bond:assigned'` to the `onTransientDelta` filter condition (around line 45)
  - [x] 1.2 Verify `BondAssignedDelta` is already in the `DeltaEventMsg` union import — it is, no import change needed

- [x] Task 2: Bond assignment overlay in `DungeonScreen.tsx` (AC: 1)
  - [x] 2.1 Add `bondOverlay` state: `useState<{ text: string; fading: boolean } | null>(null)`
  - [x] 2.2 In the `latestTransientDelta` useEffect (the one at ~line 242 handling ability:fired, enemy:killed, etc.), add a case for `bond:assigned`:
         - Look up display names: `gameState?.players.find(p => p.id === latestTransientDelta.playerA)?.displayName ?? latestTransientDelta.playerA`
         - Capitalize bond label: `latestTransientDelta.bondType === 'fate' ? 'Fate' : 'Proximity'`
         - Construct text: `"${nameA} · ${nameB} — ${label} Bond"`
         - `setBondOverlay({ text, fading: false })`
         - Schedule `setTimeout(() => setBondOverlay(o => o ? { ...o, fading: true } : o), 2500)` — triggers CSS fade
         - Schedule `setTimeout(() => setBondOverlay(null), 3000)` — clears overlay
         - Return cleanup function clearing both timers
  - [x] 2.3 Render overlay in JSX (between canvas container div and existing HUD elements, zIndex: 30)

- [x] Task 3: Particle tether Graphics in `renderFrame` (AC: 2, 3, 4)
  - [x] 3.1 Add `tetherGraphicsRef = useRef<Map<string, Graphics>>(new Map())` to DungeonScreen (alongside playerGraphicsRef etc.)
  - [x] 3.2 Pass `tetherGraphicsRef.current` to `renderFrame` as a new 6th parameter
  - [x] 3.3 In the `initPixi` useEffect cleanup, clear and destroy all tether Graphics (same pattern as playerGraphics/enemyGraphics)
  - [x] 3.4 Update `renderFrame` signature: add `tetherGraphics: Map<string, Graphics>` parameter
  - [x] 3.5 In `renderFrame`, add tether drawing logic (after essence flashes section, using `addChildAt(g, 0)` for z-order)

- [x] Task 4: Bond dots in `PlayerChipHUD` (AC: 5)
  - [x] 4.1 Change `PlayerChipHUD` props to add `bondColors: string[]` (default `[]`)
  - [x] 4.2 Inside `PlayerChipHUD`, below the HP pips row (or the spirit "◌◌◌◌◌" row), add a flex row of colored dots when `bondColors.length > 0`
  - [x] 4.3 In the chip strip JSX (the `players.map` in DungeonScreen), compute bond colors per player and pass as `bondColors` prop

## Dev Notes

### Critical: `latestTransientDelta` is cleared after 400ms in App.tsx

`App.tsx` sets `latestTransientDelta` to `null` after 400ms for ALL delta types:
```typescript
const timer = setTimeout(() => setLatestTransientDelta(null), 400);
```

This means the bond overlay **cannot** use `latestTransientDelta` to stay visible for 3 seconds. Instead, DungeonScreen must:
1. Capture the overlay data in local `bondOverlay` state the moment `bond:assigned` arrives
2. Manage its own 3s lifespan independently

The local state outlives the cleared `latestTransientDelta`. This is the correct pattern.

### Critical: `bond:assigned` is NOT in the transient delta filter (host-session.ts)

Current filter (lines ~41–58):
```typescript
if (onTransientDelta && (
  delta.type === 'ability:fired' || ...
  delta.type === 'run:complete'
)) {
  onTransientDelta(delta);
}
```

`bond:assigned` is missing. Without adding it, DungeonScreen's `latestTransientDelta` will never be `bond:assigned`, and the overlay will never show.

**Add:** `delta.type === 'bond:assigned' ||` to this filter.

Note: `bond:assigned` is already handled by `applyDelta` and reflected in `gameState.activeBonds` — that path is independent. Adding it to the transient filter just enables the ephemeral overlay trigger.

### Critical: `bond.color` is a CSS hex string, not a number

`BondState.color` is `'#6ea8d8'` or `'#f5a623'` (from `BOND_TYPE_COLORS` in game-rules/balance.ts). PixiJS needs a numeric color.

Conversion: `parseInt(bond.color.slice(1), 16)`

Do NOT use `Number('0x' + bond.color.slice(1))` — both work, but the `parseInt(slice(1), 16)` form is consistent with how other hex conversions read in TypeScript.

### PixiJS 8 Line/Stroke API

The existing `renderFrame` uses `.fill()`:
```typescript
circle.circle(0, 0, PLAYER_RADIUS).fill({ color });
```

For lines, use `.stroke()` (PixiJS 8 Graphics API):
```typescript
g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x6ea8d8, width: 2, alpha: 0.7 });
```

Always call `g.clear()` before redrawing each frame (same pattern as circle/health bar Graphics).

### PixiJS Z-order: Tethers Below Players

The PixiJS stage renders children in insertion order (index 0 = bottom). Currently player and enemy Graphics are added with `app.stage.addChild(circle)` as players join — they go to the end (top of stack).

Tethers must go BELOW players. Use `app.stage.addChildAt(g, 0)` when creating a tether — this inserts at index 0 (bottom).

**Do NOT** set `g.zIndex` and call `app.stage.sortChildren()` — that's more complex and the `addChildAt(0)` approach is simpler for this use case (ponytail).

### Overlay Fade-in/Fade-out Pattern

Using React state with `fading: boolean`:

```typescript
const [bondOverlay, setBondOverlay] = useState<{ text: string; fading: boolean } | null>(null);

// In the latestTransientDelta useEffect:
if (latestTransientDelta.type === 'bond:assigned') {
  const nameA = gameState?.players.find(p => p.id === latestTransientDelta.playerA)?.displayName
    ?? latestTransientDelta.playerA;
  const nameB = gameState?.players.find(p => p.id === latestTransientDelta.playerB)?.displayName
    ?? latestTransientDelta.playerB;
  const label = latestTransientDelta.bondType === 'fate' ? 'Fate' : 'Proximity';
  setBondOverlay({ text: `${nameA} · ${nameB} — ${label} Bond`, fading: false });
  const fadeTimer = setTimeout(() => setBondOverlay(o => o ? { ...o, fading: true } : o), 2500);
  const clearTimer = setTimeout(() => setBondOverlay(null), 3000);
  return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
}
```

Fade-in: starts at `opacity: 0` implicitly, transitions to `opacity: 1` via `transition: 'opacity 0.3s'` when `fading === false`.
Fade-out: after 2.5s, `fading` becomes `true` → `opacity: 0` with `transition: 'opacity 0.5s'`.
Clear: after 3s, `bondOverlay` is `null` and the overlay element unmounts.

### bond:assigned vs level:complete — React 18 batching caveat (pre-existing, deferred)

Story 5.4 notes: `level:complete` and `bond:assigned` arrive in the same WS batch. React 18 automatic batching means both `setLatestTransientDelta` calls (for `level:complete` and then `bond:assigned`) are batched into a single render — `latestTransientDelta` ends up as `bond:assigned`.

Consequence: the `levelClearFlash` (white canvas flash) may not fire when bond-moment follows immediately. This is pre-existing, cosmetic, and deferred. Do NOT attempt to fix it in 5.5 — it would require reworking the single-value `latestTransientDelta` prop into a queue or separate props, which is out of scope.

Document this with a `// ponytail: level:complete flash may be skipped when bond-moment follows; deferred` comment if desired.

### PlayerChipHUD chip height

The chip currently has `height: 40` with two rows:
1. Player name
2. HP pips (or spirit indicator)

Adding bond dots as a 3rd row may exceed 40px. Options:
- Let the chip grow naturally (remove fixed `height: 40` or increase to `auto`) when dots are present
- Keep fixed height and accept the dots are inside the existing space

Recommendation: set `height: 'auto'` and `minHeight: 40` on the chip div — the top strip has `height: 48` but chips are `align-items: center` inside it. Auto height is fine.

### renderFrame signature change — add tetherGraphics parameter

Current call in the ticker:
```typescript
app.ticker.add(() => {
  if (latestGameStateRef.current) {
    renderFrame(
      latestGameStateRef.current,
      app,
      playerGraphicsRef.current,
      enemyGraphicsRef.current,
      essenceFlashesRef.current,
    );
  }
});
```

Update to:
```typescript
renderFrame(
  latestGameStateRef.current,
  app,
  playerGraphicsRef.current,
  enemyGraphicsRef.current,
  essenceFlashesRef.current,
  tetherGraphicsRef.current,  // ← add
);
```

And update the `renderFrame` function signature:
```typescript
function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  enemyGraphics: Map<string, EnemyEntry>,
  essenceFlashes: Map<string, EssenceFlash>,
  tetherGraphics: Map<string, Graphics>,  // ← add
): void
```

`Graphics` is already imported at the top of DungeonScreen.tsx from `'pixi.js'`.

### Cleanup on unmount

In the `initPixi` useEffect cleanup (the `return () => { ... }` block), add:
```typescript
for (const g of tetherGraphicsRef.current.values()) { g.destroy(); }
tetherGraphicsRef.current.clear();
```
Same pattern as `playerGraphicsRef.current.clear()` etc.

### No new files needed

Both changes are additions to existing files. No new components, no new modules.

### Bond dots: handle player with no bonds gracefully

`playerBondColors` will be `[]` when a player has no bonds. The dots row only renders when `bondColors.length > 0` — no empty div rendered for non-bonded players.

### Level/bondType label mapping

BondType enum values are lowercase (`'proximity'`, `'fate'`). The overlay shows "Proximity Bond" or "Fate Bond" (title case). Map:
```typescript
const label = latestTransientDelta.bondType === 'fate' ? 'Fate' : 'Proximity';
```
A `Record<BondType, string>` map would also work, but inline ternary is sufficient for 2 values (ponytail).

### What stays the same

- No changes to `packages/net-protocol`, `packages/shared-types`, `packages/game-rules`
- `applyDelta` already handles `bond:assigned` correctly — no changes needed
- The `BondAssignedDelta` type is already in `DeltaEventMsg` union
- `host-session.ts` `applyDelta` call is already correct — only the transient filter needs updating

### Project Context Rules

**Authority model**: Host client reads `gameState.activeBonds` (mirror state) — never mutates it. All bond data originates from the sim server and arrives via `applyDelta`.

**No game-rules import**: Do NOT import `BOND_TYPE_COLORS`, `bondKey()`, or any other game-rules export in the host client. Use `bond.color` directly from `BondState`.

**PixiJS renderer**: `renderFrame` is called once per ticker tick with a snapshot reference (`latestGameStateRef.current`). Bond tether Graphics are updated inside `renderFrame` — correct pattern.

**No Math.random()**: Not applicable — no randomness in tether rendering.

**Tick hygiene**: No `logger.*` calls inside `renderFrame` — it runs at display FPS (~60hz). Tether logic is O(n) where n ≤ 3; no perf concern.

**Serialization**: No serialization in host UI code.

**CSS tokens**: Use `var(--font-display)`, `var(--text-xl)`, `var(--accent-spirit)` from `packages/ui-kit/src/tokens.css` — already imported by host-client.

**couch readability**: `var(--text-xl)` = 40px meets the "minimum 24px at 1080p" from host screen constraints, and the epics specify 40px minimum.

### References

- [Source: _bmad-output/planning-artifacts/epics.md lines 1112–1144 — Story 5.5 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md lines 295–300 — bond overlay text spec]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md lines 273–289 — bond moment host screen]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md lines 580–595 — flow narrative bond moment]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md lines 340–345 — glow shadow spec]
- [Source: packages/ui-kit/src/tokens.css — all CSS custom property values]
- [Source: apps/host-client/index.html — confirms Uncial Antiqua loaded from Google Fonts]
- [Source: apps/host-client/src/screens/DungeonScreen.tsx — full renderFrame, PlayerChipHUD, useEffects]
- [Source: apps/host-client/src/session/host-session.ts lines 41–59 — transient delta filter to update]
- [Source: packages/net-protocol/src/messages/server-to-host.ts — BondAssignedDelta shape]
- [Source: packages/shared-types/src/bond.ts — BondState shape]
- [Source: packages/game-rules/src/balance.ts lines 117–121 — BOND_TYPE_COLORS (shows actual color values)]
- [Source: packages/net-protocol/src/apply-delta.ts lines 129–136 — bond:assigned handling]
- [Source: _bmad-output/implementation-artifacts/5-4-bond-assignment-integration-at-level-completion.md — dev notes on bond:assigned timing and batching issue]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation matched spec exactly; typecheck passed on first pass.

### Completion Notes List

- Task 1: Added `delta.type === 'bond:assigned'` to the transient filter in `host-session.ts` (line 56). This is the only change to that file; `applyDelta` path was already correct.
- Task 2: Added `bondOverlay` state to DungeonScreen; added `bond:assigned` case as the first branch in the transient delta useEffect. Uses 2.5s fade-start + 3s clear timers managed independently of the 400ms `latestTransientDelta` reset in App.tsx. Bond overlay JSX at zIndex 30, no panel/border, Uncial Antiqua 40px, accent-spirit glow.
- Task 3: Added `tetherGraphicsRef` (Map<string, Graphics>); updated `renderFrame` to accept a 6th `tetherGraphics` parameter. Tether logic runs after essence flashes: prunes stale bonds, creates new Graphics with `addChildAt(g, 0)` for z-order, clears and redraws each frame. Cleanup destroys all tether Graphics on unmount. `bond.color` hex string converted via `parseInt(slice(1), 16)` for PixiJS.
- Task 4: Updated `PlayerChipHUD` to accept `bondColors: string[]`; chip div uses `minHeight: 40, height: 'auto'` to accommodate dots row. Bond dots (8×8 circles) rendered below HP pips when `bondColors.length > 0`. Colors computed inline in `players.map` from `gameState.activeBonds`.
- Deferred (pre-existing): `level:complete` flash may be skipped when `bond:assigned` follows in the same React 18 batch. Noted with `ponytail:` comment; not fixed in 5.5.

### File List

- `apps/host-client/src/session/host-session.ts`
- `apps/host-client/src/screens/DungeonScreen.tsx`

### Review Findings

- [x] [Review][Patch] Tether key separator mismatch — fixed: changed `-` to `+` to match server's `bondKey()` [DungeonScreen.tsx:158,165]
- [x] [Review][Patch] Fade timer fires 500ms early — fixed: fadeTimer 2500→2700ms, clearTimer 3000→3200ms [DungeonScreen.tsx:282]
- [x] [Review][Patch] Dead double-destroy loop — fixed: removed `g.destroy()` loop; `tetherGraphicsRef.current.clear()` is sufficient [DungeonScreen.tsx:258]
- [x] [Review][Defer] Stale ticker rAF callback on unmount [DungeonScreen.tsx:233] — deferred, pre-existing (same issue applies to all renderFrame Graphics)
- [x] [Review][Defer] `onTransientDelta` fires before `applyDelta` — structural ordering pre-dates 5.5; no practical bug for bond:assigned (bond:assigned never adds players; React 18 batching means gameState is post-delta by the time the effect runs) [host-session.ts:59]
- [x] [Review][Defer] Missing `gameState` in `useEffect([latestTransientDelta])` deps — lint warning risk; no runtime bug because display names are stable during a run and React 18 batching keeps both state updates in sync [DungeonScreen.tsx:307]

### Change Log

| Date | Change |
|------|--------|
| 2026-07-03 | Story 5.5 created; ready-for-dev |
| 2026-07-03 | Implemented all tasks; AC1–AC5 satisfied; typecheck clean; status → review |
| 2026-07-03 | Ultra code review: 3 patches, 3 deferred, 5 dismissed |

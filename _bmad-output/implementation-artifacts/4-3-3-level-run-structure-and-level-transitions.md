---
baseline_commit: 04ebbfa
---

# Story 4.3: 3-Level Run Structure & Level Transitions

Status: review

## CLAUDE.md Required Task Header

```
Phase: 4 — Procedural Dungeon & Full Run Structure (Epic 4)
Context: Stories 4.1 and 4.2 should be completed before this story.
  4.1 adds generateFloorLayout() and GameState.floorLayout.
  4.2 adds startDungeon(difficulty), session.difficulty, and GameState.runProposal.
  Right now, the entire dungeon is one level: when all enemies die, GameRoom immediately
  broadcasts level:complete THEN run:complete and sets phase='post-run'. The levelIndex
  is set to 1 and never incremented. spawnEnemies() always uses the 'early' tier.
  This story replaces that stub with a real 3-level loop: level 1 (early), level 2 (mid),
  level 3 (late), then a boss placeholder at level 4 (empty room + victory trigger zone
  at the far end). The mobile controller and net-protocol are untouched — all needed
  delta types already exist.
Owner agent: Simulation Engineer (primary — GameRoom.ts + world.ts)
             Host Experience Engineer (secondary — DungeonScreen.tsx top strip)
Goal: Implement the 3-level run loop in GameRoom, level-to-level transition logic
  (clear enemies, advance revive windows, respawn players, load next level),
  boss-placeholder level 4 with a physics victory trigger zone, and host top strip
  showing the current level index and biome name. Add the PixiJS Assets.backgroundLoad()
  hook during Level 1.
Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts      (MODIFY — core change)
  - apps/simulation-server/src/physics/world.ts       (MODIFY — add createVictoryTriggerBody)
  - apps/host-client/src/screens/DungeonScreen.tsx    (MODIFY — level display, backgroundLoad)
Blocked paths:
  - packages/shared-types/**     (levelIndex already in SessionState; no new types needed)
  - packages/net-protocol/**     (level:complete and run:complete already exist)
  - packages/game-rules/**       (getEnemyCount already exported; no changes needed)
  - apps/mobile-controller/**    (no mobile changes in this story)
  - tests/e2e/**                 (e2e test is Story 4.6)
Inputs:
  - apps/simulation-server/src/rooms/GameRoom.ts      (current level-clear block, spawnEnemies)
  - apps/simulation-server/src/physics/world.ts       (createPoiSensorBody, createEssenceSensorBody patterns)
  - apps/host-client/src/screens/DungeonScreen.tsx    (top strip layout, latestTransientDelta handler)
  - packages/game-rules/src/balance.ts                (getEnemyCount with 'early'|'mid'|'late')
  - packages/shared-types/src/session.ts              (SessionState.levelIndex, SessionState.difficulty)
  - packages/shared-types/src/constants.ts            (OFFSET_ENEMY_SPAWN and other OFFSET_* constants)
Non-goals:
  - Floor layout rendering per room template (Story 4.1 wires layout generation; this story
    does not render rooms — DungeonScreen still shows the plain combat canvas)
  - Survive the Waves objective (Story 4.4 — all levels in this story use Clear objective)
  - Post-run summary screen (Story 4.5)
  - Real boss behavior (Epic 6 — level 4 is a static empty room with a trigger zone)
  - Spirit Bond assignment between levels (Epic 5)
  - Biome asset bundles (Epic 9 — backgroundLoad call is a no-op placeholder for alpha)
  - Enemy variety beyond EnemyType.GRUNT (alpha scope)
Acceptance criteria:
  AC1: When Level 1 loads (levelIndex=1), enemies spawn with 'early' tier density from
       getEnemyCount(playerCount, 'early'). Top strip shows "Level 1 — Grassland".
  AC2: PixiJS Assets.backgroundLoad([]) is called once when levelIndex transitions to 1
       (or on DungeonScreen mount). This is a no-op for alpha; the call must exist as
       the integration point for Epic 9 biome bundles.
  AC3: When Level 1's Clear objective completes (all enemies dead), level:complete fires
       for index 1, revive windows advance for any downed players, and Level 2 loads
       with 'mid' tier enemies. Top strip updates to "Level 2 — Grassland".
  AC4: When Level 2 completes, Level 3 loads with 'late' tier enemies.
       Top strip shows "Level 3 — Grassland".
  AC5: When Level 3 completes, Level 4 (boss placeholder) loads — an empty room with
       no enemies and a circular victory trigger zone at x=1700, y=540, r=120px.
       Top strip shows "Level 4 — Grassland".
  AC6: When any living player enters the victory trigger zone, run:complete is broadcast
       and phase transitions to 'post-run'. The existing success overlay in DungeonScreen
       renders as before.
  AC7: Between level transitions, downed players are auto-revived (isDown=false) but retain
       their downCount (next revive window is shorter). Spirit players (isSpirit=true) are
       also returned to alive state (isSpirit=false, hp=REVIVE_HP) for the new level.
       A full snapshot is broadcast after each level load so all clients are in sync.
  AC8: Enemy PRNG is level-seeded: Level N uses createRng(runSeed ^ (OFFSET_ENEMY_SPAWN | (N << 8))).
       Two independent sim instances with the same runSeed produce identical enemy positions
       per level.
Required hooks:
  - Simulation-safety hook: GameRoom.ts and world.ts are touched.
    Required: tsc --noEmit passes in all packages; all existing tests pass.
  - Client-UX hook: DungeonScreen.tsx is touched.
    Host checks: level label legible at couch distance (Lora 700, sm, text-primary as specified).
Required tests:
  - All existing tests must remain green (222+ tests).
  - No new unit tests required for this story (the level transition logic is integration-
    tested by running the dungeon; Story 4.6 owns the formal e2e test). Optional: add a
    quick assertion in tests/unit/generation.test.ts that PRNG level seeding produces
    different sequences for different level indices.
Telemetry impact: None — level transitions are not a tracked KPI for this story.
```

---

## Story

As a player,
I want to progress through three dungeon levels with the dungeon getting harder each level,
so that each run has a sense of escalating stakes and forward momentum.

---

## Acceptance Criteria

**AC1 — Level 1 loads with early-tier enemies:**
**Given** a run has started
**When** Level 1 loads
**Then** the level index and biome name are displayed in the host top strip (Lora 700, sm, text-primary)
**And** the level is populated with enemies from the Grassland pool appropriate to "early room" tier (fewer enemies, simpler composition)
**And** PixiJS `Assets.backgroundLoad()` is called during Level 1 for any biome assets needed in later levels — no mid-combat asset hitches

**AC2 — Level 1 → Level 2 transition:**
**Given** Level 1's Clear objective is completed
**When** `level:complete` fires for index 1
**Then** Spirit Essence is tallied (already tracked per-player; no new logic)
**And** revive windows advance for any previously downed players (downCount already incremented when they went down; new window will be shorter on next down)
**And** Level 2 loads with "mid-tier" room pool (increased enemy count scaled by player count)
**And** the top strip updates to show "Level 2"

**AC3 — Level 2 → Level 3 transition:**
**Given** Level 2 is completed
**When** `level:complete` fires for index 2
**Then** Level 3 loads with "late-tier" room pool (highest pre-boss enemy density)

**AC4 — Level 3 → Level 4 (boss placeholder):**
**Given** Level 3 is completed
**When** `level:complete` fires for index 3
**Then** the placeholder Level 4 (boss slot) loads — a static empty room with a "Victory" trigger zone at the far end (x=1700, y=540)
**And** when any living player reaches the trigger zone, `run:complete` is broadcast and the post-run summary renders

---

## Tasks / Subtasks

- [x] T1: physics/world.ts — add victory trigger body helper (AC5, AC6)
  - [x] T1.1: Add `createVictoryTriggerBody(world: World, x: number, y: number, radius: number): Body`
    — circular sensor body with `isSensor: true`, no fixture userData needed (GameRoom checks by body reference)
  - [x] T1.2: Export the function (it's only used in GameRoom.ts but keep it in world.ts for consistency with the POI/essence helpers)

- [x] T2: GameRoom.ts — refactor spawnEnemies + add loadLevel (AC1, AC3, AC4, AC8)
  - [x] T2.1: Add `private victoryTriggerBody: Body | null = null;` field
  - [x] T2.2: Add `private pendingVictoryContact = false;` field
  - [x] T2.3: Add dungeon spawn positions array (see Dev Notes: DUNGEON_SPAWN_POSITIONS)
  - [x] T2.4: Modify `spawnEnemies()` signature to `spawnEnemies(tier: 'early' | 'mid' | 'late', levelIndex: number): void`
    — use `createRng(runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8)))` for deterministic per-level seeding
    — use `getEnemyCount(playerCount, tier)` for count
    — enemy ids: `enemy-L${levelIndex}-${i}` (avoids id collision across levels)
    — pass `session.difficulty ?? DifficultyTier.EASY` as enemy difficultyTier
  - [x] T2.5: Add `private loadLevel(index: number): void` method (see Dev Notes for full pseudocode)
  - [x] T2.6: Wire loadLevel in the begin-contact handler: detect victoryTriggerBody contact and set pendingVictoryContact
  - [x] T2.7: Update existing HOST_START handler and startDungeon() (if 4.2 done):
    — replace direct `spawnEnemies()` call with `loadLevel(1)`
    — levelIndex is already set to 1 before calling; loadLevel should take the target index
  - [x] T2.8: Replace the level-clear block in tick() (currently fires both level:complete AND run:complete immediately):
    — When all enemies dead AND levelIndex < 4: broadcast level:complete, then call loadLevel(levelIndex + 1), broadcast snapshot
    — When levelIndex === 4 AND pendingVictoryContact: broadcast run:complete, set phase='post-run'; clear pendingVictoryContact
  - [x] T2.9: Clean up victory trigger body in onDispose()

- [x] T3: DungeonScreen.tsx — level/biome display and backgroundLoad hook (AC1, AC2)
  - [x] T3.1: Replace hardcoded "Clear" label in the top strip with level + biome display:
    `Level {gameState.session.levelIndex} — Grassland` (Lora 700, sm, text-primary)
  - [x] T3.2: Add `useEffect` that calls `Assets.backgroundLoad([])` when levelIndex === 1
    — import `Assets` from `'pixi.js'`
    — add a `// ponytail: no-op for alpha — wire real biome bundle URL in Epic 9` comment

### Review Findings

- [x] [Review][Patch] victoryTriggerBody left live in physics world after run:complete [GameRoom.ts:967-976] — Body is not destroyed when the victory trigger check fires; stays alive in planck.js until onDispose, firing stale begin-contact callbacks each tick during post-run. Fix: destroy and null `this.victoryTriggerBody` immediately after broadcasting run:complete.
- [x] [Review][Defer] HOST_START re-entry from post-run without lobby reset [GameRoom.ts:~126] — deferred, pre-existing; startDungeon has no guard against being called from phase==='post-run'. Not introduced by this story.
- [x] [Review][Defer] Boss check `=== 4` vs `>= 4` in loadLevel [GameRoom.ts:968] — deferred, unreachable; level 4 has no enemies so level-clear never increments beyond 4. Asymmetry is a gotcha if enemy spawning at level 4 is ever added.
- [x] [Review][Defer] O(n²) indexOf in player spawn loop [GameRoom.ts:482] — deferred, negligible; 64 ops max at MAX_PLAYERS=8.

---

## Dev Notes

### The Core Change in GameRoom.ts

The current tick() level-clear block (search for `"Level clear: all enemies defeated"` comment) does:
```typescript
// current (stub — fires run:complete immediately after level:complete)
if (enemies.length > 0 && enemies.every(e => !e.isAlive)) {
  const levelIndex = this.gameState.session.levelIndex;
  this.gameState.session.phase = 'post-run';          // ← remove this
  this.broadcast(EventNames.DELTA, { type: 'level:complete', levelIndex });
  // ... revive window logic ...
  this.broadcast(EventNames.DELTA, { type: 'run:complete', totalEssence });  // ← remove this
}
```

Replace with:
```typescript
// new: multi-level loop
if (this.gameState.enemies.length > 0 && this.gameState.enemies.every(e => !e.isAlive)) {
  const levelIndex = this.gameState.session.levelIndex;
  this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
  this.loadLevel(levelIndex + 1);
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId, nextLevel: levelIndex + 1 }, 'level complete — loading next level');
}

// Boss placeholder: victory trigger contact
if (this.gameState.session.phase === 'dungeon'
    && this.gameState.session.levelIndex === 4
    && this.pendingVictoryContact) {
  this.pendingVictoryContact = false;
  const totalEssence = this.gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0);
  this.gameState.session.phase = 'post-run';
  this.broadcast(EventNames.DELTA, { type: 'run:complete' as const, totalEssence } satisfies DeltaEventMsg);
  logger.info({ roomId: this.roomId, totalEssence }, 'boss placeholder — victory zone reached, run complete');
}
```

### The loadLevel() Method

```typescript
private loadLevel(index: number): void {
  // ── Clear current enemies ─────────────────────────────────────────────────
  for (const body of this.enemyBodies.values()) this.physicsWorld.destroyBody(body);
  this.enemyBodies.clear();
  this.enemyLayers.clear();
  this.enemyAttackCooldowns.clear();
  this.gameState.enemies = [];

  // ── Clear essence drops ───────────────────────────────────────────────────
  for (const body of this.essenceSensorBodies.values()) this.physicsWorld.destroyBody(body);
  this.essenceSensorBodies.clear();
  this.gameState.essenceDrops = [];

  // ── Clear previous victory trigger (if any) ───────────────────────────────
  if (this.victoryTriggerBody) {
    this.physicsWorld.destroyBody(this.victoryTriggerBody);
    this.victoryTriggerBody = null;
  }
  this.pendingVictoryContact = false;

  // ── Advance revive windows; auto-revive downed/spirit players ────────────
  // Downed players carry their downCount (shorter next window) but are alive for the new level.
  // Spirit players also get restored — run failure (all-in-spirit) would have ended the run,
  // so any spirits here are edge cases (snapshot reconciliation after reconnect, etc.).
  for (const player of this.gameState.players) {
    if (player.isDown || player.isSpirit) {
      player.isDown = false;
      player.isSpirit = false;
      player.reviveTimerExpiresAt = 0;
      player.hp = REVIVE_HP;
    }
    // Teleport to dungeon spawn position for the new level
    const spawn = DUNGEON_SPAWN_POSITIONS[this.gameState.players.indexOf(player)] ?? { x: 400, y: 540 };
    player.x = spawn.x;
    player.y = spawn.y;
    const body = this.playerBodies.get(player.id);
    if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
  }

  // ── Update level index ────────────────────────────────────────────────────
  this.gameState.session.levelIndex = index;

  // ── Load level content ────────────────────────────────────────────────────
  if (index >= 4) {
    // Boss placeholder: no enemies, just a victory trigger zone at the far end
    this.victoryTriggerBody = createVictoryTriggerBody(this.physicsWorld, 1700, 540, 120);
    logger.info({ roomId: this.roomId }, 'boss placeholder level loaded — victory trigger at (1700, 540)');
  } else {
    const tier = index === 1 ? 'early' : index === 2 ? 'mid' : 'late';
    this.spawnEnemies(tier, index);
  }
}
```

### DUNGEON_SPAWN_POSITIONS

Players are teleported to these positions at the start of each level (left side of dungeon area, safe from enemy spawn zone):

```typescript
const DUNGEON_SPAWN_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 300, y: 540 }, { x: 300, y: 480 }, { x: 300, y: 600 }, { x: 240, y: 510 },
  { x: 240, y: 570 }, { x: 360, y: 510 }, { x: 360, y: 570 }, { x: 300, y: 420 },
];
```

Enemy spawns currently use `200 + rng() * 1520` x and `200 + rng() * 680` y. Player spawns at x=240–360 are inside the enemy range — adjust enemy spawn x to `600 + rng() * 1120` so they don't overlap with player entry positions. This is a one-line change in spawnEnemies().

### spawnEnemies() Signature Change

```typescript
// OLD (Story 3.x stub):
private spawnEnemies(): void {
  const count = getEnemyCount(this.gameState.players.length, 'early');
  const enemyPrng = createRng(this.gameState.session.runSeed ^ OFFSET_ENEMY_SPAWN);
  // enemies use `enemy-${i}` ids; DifficultyTier.EASY hardcoded

// NEW:
private spawnEnemies(tier: 'early' | 'mid' | 'late', levelIndex: number): void {
  const count = getEnemyCount(this.gameState.players.length, tier);
  const enemyPrng = createRng(this.gameState.session.runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8)));
  const difficulty = this.gameState.session.difficulty ?? DifficultyTier.EASY;
  // enemy ids: `enemy-L${levelIndex}-${i}`
  // enemy x: 600 + enemyPrng() * 1120 (shifted right to avoid player spawn zone)
  // enemy y: 200 + enemyPrng() * 680
  // difficultyTier: difficulty (from session)
```

Note: `this.gameState.session.difficulty` is added by Story 4.2. If 4.2 is not yet done, fall back to `DifficultyTier.EASY` (already the hardcoded value).

### Victory Trigger Contact Detection

Add to the `begin-contact` listener in `onCreate`:
```typescript
this.physicsWorld.on('begin-contact', (contact: Contact) => {
  const bodyA = contact.getFixtureA().getBody();
  const bodyB = contact.getFixtureB().getBody();

  // Existing POI detection
  const poiEvt = extractPoiBeginContact(contact);
  if (poiEvt) this.pendingPoiBeginContacts.push(poiEvt);
  // Existing essence detection
  const essenceEvt = extractEssenceBeginContact(contact);
  if (essenceEvt) this.pendingEssenceBeginContacts.push(essenceEvt);

  // NEW: victory trigger detection
  if (this.victoryTriggerBody
      && (bodyA === this.victoryTriggerBody || bodyB === this.victoryTriggerBody)) {
    // Check the other body is a player body (not frozen/downed/spirit)
    const otherBody = bodyA === this.victoryTriggerBody ? bodyB : bodyA;
    const playerId = otherBody.getUserData() as string | null;
    if (playerId) {
      const player = this.gameState.players.find(p => p.id === playerId);
      if (player && !player.isFrozen && !player.isDown && !player.isSpirit) {
        this.pendingVictoryContact = true;
      }
    }
  }
});
```

Note: `createPlayerBody` in world.ts sets the player body userData to the player id string. Verify this before implementing (grep `setUserData` in world.ts).

### createVictoryTriggerBody in world.ts

The existing helper functions in `apps/simulation-server/src/physics/world.ts` follow this pattern:
- `createPoiSensorBody(world, poi)` — creates a circular sensor, sets `userData = { type: 'poi', ... }`
- `createEssenceSensorBody(world, dropId, x, y)` — creates a circular sensor, sets `userData = { type: 'essence', dropId }`

Add:
```typescript
export function createVictoryTriggerBody(world: World, x: number, y: number, radiusPx: number): Body {
  const body = world.createBody({ type: 'static', position: Vec2(toMeters(x), toMeters(y)) });
  const shape = Circle(toMeters(radiusPx));
  body.createFixture({ shape, isSensor: true });
  // No userData needed — GameRoom identifies by body reference
  return body;
}
```

### Dependency on Stories 4.1 and 4.2

**Story 4.1** adds:
- `GameState.floorLayout: FloorLayout | null`
- `generateFloorLayout()` call in the HOST_START/startDungeon() handler

This story does NOT use floorLayout for rendering (the dungeon is still a plain combat canvas). The field will just be null for levels 2–4 since `generateFloorLayout()` was only called for level 1. Story 4.3 should call `generateFloorLayout()` in `loadLevel()` for each level if 4.1 is done — OR leave it for a later polish pass. The AC doesn't require per-level layout generation; it requires the multi-level enemy loop. Leave floorLayout as-is between levels.

**If Story 4.1 is NOT done:** `GameState` has no `floorLayout` field. No action needed; just omit any `floorLayout` references.

**Story 4.2** adds:
- `startDungeon(difficulty: DifficultyTier): void` — extracted from HOST_START logic
- `session.difficulty: DifficultyTier | null`
- `GameState.runProposal: RunProposal | null`
- EventNames.RUN_STARTING etc.

This story depends on `startDungeon()` existing. If 4.2 is done, update `startDungeon()` to call `loadLevel(1)` instead of `spawnEnemies()`. If 4.2 is NOT done, update the `HOST_START` handler directly instead.

**If Story 4.2 is NOT done:** `session.difficulty` doesn't exist; use `DifficultyTier.EASY` hardcoded in spawnEnemies.

### DungeonScreen Top Strip Change

Current top strip right side:
```tsx
{gameState?.session.phase === 'dungeon' && (
  <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontWeight: 700,
    fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
    Clear
  </div>
)}
```

Replace with:
```tsx
{gameState?.session.phase === 'dungeon' && (
  <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontWeight: 700,
    fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
    Level {gameState.session.levelIndex} — Grassland
  </div>
)}
```

### PixiJS backgroundLoad Hook

Add to DungeonScreen (after the existing PixiJS init effect):
```tsx
// Preload biome assets during Level 1 to avoid mid-combat hitches on later levels
useEffect(() => {
  if (gameState?.session.levelIndex === 1) {
    // ponytail: no-op for alpha — wire real Grassland biome bundle URL in Epic 9
    void Assets.backgroundLoad([]);
  }
}, [gameState?.session.levelIndex]);
```

Add `Assets` to the pixi.js import line.

### What NOT to Re-Implement

- `getEnemyCount(playerCount, tier)` — already in game-rules, already imported in GameRoom.ts via the game-rules import block
- `OFFSET_ENEMY_SPAWN` — already in shared-types constants, already imported in GameRoom.ts
- `DifficultyTier` — already imported in GameRoom.ts
- `REVIVE_HP` — already imported in GameRoom.ts from game-rules
- `level:complete` and `run:complete` delta types — already in `DeltaEventMsg` union in net-protocol
- `EnemyLayers` wiring — `enemyLayers` map is currently unused (layers are not added to enemies yet); don't add them in this story
- The revive-expiry and proximity-revive blocks in tick() — these are correct and do not need changes

### The this.prng Field

`this.prng = createRng(this.gameState.session.runSeed)` is set in onCreate but is currently unused — it was likely a placeholder. Do NOT use it for level enemy spawning; use the per-level seeded RNG in spawnEnemies() instead. Leave `this.prng` as-is to avoid breaking anything that might reference it.

### Run Failure Before Level Transition

The run-failure check (`all players in spirit form`) in tick() fires before the level-clear check. This ordering is correct and must be preserved. If all players enter spirit form AND all enemies are dead in the same tick, the run failure takes priority.

### Tick Order After the Change

The new dungeon tick section order should be:
1. Physics step (player movement, contacts)
2. POI contacts (hub phase only)
3. Essence collection
4. Enemy AI
5. Ability dispatch
6. Spirit ability dispatch
7. Enemy melee attacks
8. Revive timer expiry and proximity revive
9. **Run failure check** (all-in-spirit-form → run:failed)
10. **Level clear check** (all enemies dead and levelIndex < 4 → loadLevel(next), snapshot)
11. **Victory trigger check** (levelIndex === 4 and pendingVictoryContact → run:complete)
12. Cooldown expiry notifications
13. Periodic snapshot

### Testing Guidance

Run these after implementation:
```bash
npm run typecheck --workspace=apps/simulation-server
npm run typecheck --workspace=apps/host-client
npm test --workspace=tests
```

All 222+ existing tests must pass. The multi-level flow is best verified by running the game and playing through two level clears (or by a quick manual test: connect 1 player, dev-start dungeon, kill all enemies twice).

---

## Dev Agent Record

### Completion Notes

All three files changed exactly as specified. One correction from the story Dev Notes: `createPlayerBody`
stores `{ type: 'player', playerId }` (tagged union) as body userData, not a plain string. The victory
trigger contact handler uses `data?.type === 'player'` to extract `data.playerId` instead of casting to
`string | null`.

`getReviveWindowMs` was removed from the game-rules import — it was only used by the old level-clear stub
and is no longer referenced. All other imports are unchanged.

Total tests: 140 passing (113 in tests/, 23 in apps/simulation-server/tests/, 4 in packages/game-rules/tests).
TypeScript: no errors in simulation-server or host-client.

### File List

- apps/simulation-server/src/physics/world.ts
- apps/simulation-server/src/rooms/GameRoom.ts
- apps/host-client/src/screens/DungeonScreen.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/4-3-3-level-run-structure-and-level-transitions.md

### Change Log

- 2026-07-01: Implemented 3-level run structure and level transitions (Story 4.3)

---

## Story Completion Status

- Status: done
- Context engine analysis: complete
- Notes: All needed types (levelIndex, level:complete, run:complete, DifficultyTier, getEnemyCount)
  already exist. The change is entirely within GameRoom.ts (multi-level loop), world.ts (victory trigger
  body), and DungeonScreen.tsx (level label + backgroundLoad). No protocol changes; no mobile changes.
  Stories 4.1 and 4.2 should be done first. See Dev Notes for handling the case where they are not.

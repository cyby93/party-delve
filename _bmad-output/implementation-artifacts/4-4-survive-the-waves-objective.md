---
baseline_commit: 04ebbfa
---

# Story 4.4: Survive the Waves Objective

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 4 — Procedural Dungeon & Full Run Structure (Epic 4)
Context: Stories 4.1, 4.2, and 4.3 must be done before this story.
  4.3 adds loadLevel(index), spawnEnemies(tier, levelIndex), DUNGEON_SPAWN_POSITIONS,
  createVictoryTriggerBody, the multi-level tick loop, and the "Level X — Grassland"
  top strip label. After 4.3, all three dungeon levels use the "Clear" objective
  (kill all enemies → level:complete → loadLevel(next)). This story adds the second
  objective type: Survive the Waves. Level 2 (mid tier) becomes a wave-based level;
  Levels 1 and 3 remain Clear. The wave loop requires new SessionState fields
  (levelObjective, waveIndex, totalWaves) and two new delta types (wave:started,
  wave:complete) triggering the contract-change hook.
Owner agent: Protocol Architect (shared-types + net-protocol type additions)
             Simulation Engineer (primary — game-rules balance + GameRoom.ts wave logic)
             Host Experience Engineer (secondary — DungeonScreen.tsx objective display)
Goal: Add Survive the Waves as a first-class objective type. Level 2 sends enemies in
  3 waves with escalating count and a brief pause between waves. The host top strip
  shows "Survive: N Waves" and a wave counter. level:complete fires when the last wave
  clears, advancing to Level 3 exactly as Clear does.
Allowed paths:
  - packages/shared-types/src/session.ts                (MODIFY — add levelObjective, waveIndex, totalWaves)
  - packages/net-protocol/src/messages/server-to-host.ts (MODIFY — add WaveStartedDelta, WaveCompleteDelta)
  - packages/net-protocol/src/apply-delta.ts             (MODIFY — add wave:started case)
  - packages/game-rules/src/balance.ts                   (MODIFY — add WAVE_COUNTS, WAVE_PAUSE_MS, WAVE_ENEMY_SCALE)
  - apps/simulation-server/src/rooms/GameRoom.ts         (MODIFY — wave fields, spawnWave(), tick branch)
  - apps/host-client/src/screens/DungeonScreen.tsx       (MODIFY — objective label, wave counter)
  - tests/contract/net-protocol.test.ts                  (MODIFY — add wave delta round-trip tests)
Blocked paths:
  - apps/mobile-controller/**     (no mobile changes in this story)
  - packages/game-rules/src/**    (only balance.ts; no FSM, physics, or system changes)
  - packages/shared-types/src/game-state.ts  (GameState shape unchanged; only SessionState grows)
  - tests/e2e/**                  (e2e coverage in Story 4.6)
Inputs:
  - packages/shared-types/src/session.ts                 (current SessionState — fields to extend)
  - packages/net-protocol/src/messages/server-to-host.ts (DeltaEventMsg union — need wave types added)
  - packages/net-protocol/src/apply-delta.ts             (switch to extend with wave:started)
  - packages/game-rules/src/balance.ts                   (existing WAVE_* constants absent — add them)
  - apps/simulation-server/src/rooms/GameRoom.ts         (loadLevel + tick clear block from 4.3)
  - apps/host-client/src/screens/DungeonScreen.tsx       (top strip label from 4.3)
Non-goals:
  - Multiple enemy types per wave (alpha scope — all GRUNT)
  - Directional wave entry from all four edges (right-half spawn only in alpha)
  - Mobile wave notification popup (not in UX spec for alpha)
  - Per-wave difficulty escalation beyond count scaling (behavior layers unchanged)
  - Spirit Bond assignment between waves (Epic 5)
  - Post-run summary screen (Story 4.5)
  - Floor layout rendering (Story 4.1 + later polish)
Acceptance criteria:
  AC1: When Level 2 loads (loadLevel(2)), levelObjective is set to 'survive-waves' in
       GameState.session. The host top strip right label reads
       "Level 2 — Survive: 3 Waves". session.waveIndex = 0, session.totalWaves = 3
       before Wave 1 spawns.
  AC2: Wave 1 spawns immediately when Level 2 loads (waveIndex becomes 1).
       A wave:started delta {waveIndex:1, totalWaves:3} is broadcast.
       A wave progress indicator in the top strip shows "Wave 1 / 3".
       Enemies spawn in the right half of the dungeon (x ≥ 1200).
  AC3: When all Wave 1 enemies are killed, a brief pause of WAVE_PAUSE_MS (~2500ms)
       elapses, then Wave 2 spawns with a higher enemy count. wave:complete and
       wave:started deltas are broadcast in order. The wave counter updates to
       "Wave 2 / 3".
  AC4: When all Wave 3 enemies are killed, level:complete fires (levelIndex=2),
       revive windows advance for any downed players, and Level 3 loads with the
       Clear objective ('late' tier enemies, Clear top label). The transition
       is identical to a Clear-objective level:complete.
  AC5: If all players enter spirit form during a Survive the Waves level, run:failed
       fires (existing run-failure check). The wave loop stops; no new wave spawns
       after run:failed.
  AC6: Levels 1 and 3 remain Clear objective (unaffected by this story).
       Top labels: "Level 1 — Grassland" (Clear) and "Level 3 — Grassland" (Clear).
  AC7: Contract test: wave:started and wave:complete round-trip serialization passes
       in tests/contract/net-protocol.test.ts.
  AC8: All 222+ existing tests pass after this change (tsc --noEmit clean on all
       packages, npm test --workspace=tests green).
Required hooks:
  - Contract-change hook: shared-types and net-protocol are modified.
    Required: Protocol Architect review, at least one new contract test (AC7),
    spec or ADR update if additive. The new SessionState fields and delta types are
    additive; the existing DeltaEventMsg default exhaustiveness guard must remain
    intact after adding the new variants.
  - Simulation-safety hook: GameRoom.ts and game-rules/balance.ts are touched.
    Required: tsc --noEmit passes in all packages; all existing tests pass.
  - Client-UX hook: DungeonScreen.tsx is touched.
    Host checks: Survive label and wave counter legible at couch distance (Lora 700,
    sm, text-primary).
Required tests:
  - tests/contract/net-protocol.test.ts: Add serialize → deserialize round-trips for
    WaveStartedDelta and WaveCompleteDelta (AC7).
  - All 222+ existing tests must remain green.
  - Optional unit test: verify WAVE_COUNTS['mid'] === 3, WAVE_ENEMY_SCALE totals.
Telemetry impact: None for alpha — wave start/complete are not tracked KPIs yet.
```

---

## Story

As a player,
I want some levels to challenge me to hold out against waves of enemies rather than hunt them all down,
so that each level feels tactically different and requires different positioning.

---

## Acceptance Criteria

**AC1 — Level 2 loads as Survive the Waves:**
**Given** Level 1 is completed and `loadLevel(2)` is called
**When** Level 2 loads
**Then** `session.levelObjective` = `'survive-waves'`, `session.waveIndex` = `0`, `session.totalWaves` = `3`
**And** the host top strip right label reads "Level 2 — Survive: 3 Waves" (Lora 700, sm, text-primary)

**AC2 — Wave 1 spawns on level load:**
**Given** Level 2 loads with Survive the Waves objective
**When** Wave 1 spawns
**Then** `session.waveIndex` = `1`; `wave:started { waveIndex: 1, totalWaves: 3 }` is broadcast
**And** the wave counter in the host top strip shows "Wave 1 / 3"
**And** enemies spawn in the right half of the arena (x ≥ 1200) so players have reaction space

**AC3 — Wave clears → pause → next wave:**
**Given** the Survive the Waves objective is active and all current-wave enemies are killed
**When** the current wave clears
**Then** `wave:complete { waveIndex: N }` is broadcast
**And** after a WAVE_PAUSE_MS pause (~2500ms) the next wave spawns, broadcasting `wave:started`
**And** the next wave has more enemies than the previous (scaled by WAVE_ENEMY_SCALE)
**And** the wave counter increments

**AC4 — All waves cleared → level:complete:**
**Given** Wave 3 is cleared (the last wave)
**When** all Wave 3 enemies are killed
**Then** `wave:complete { waveIndex: 3 }` is broadcast
**And** `level:complete { levelIndex: 2 }` fires; revive windows advance for any downed players
**And** `loadLevel(3)` runs — Level 3 loads as a Clear objective level ('late' tier)

**AC5 — Run failure during Survive the Waves:**
**Given** all players enter spirit form simultaneously during a Survive the Waves level
**When** the last alive player's health drops to zero
**Then** `run:failed` fires (existing check, unchanged) and the wave loop halts

**AC6 — Clear levels unaffected:**
**Given** Level 1 or Level 3 is active
**When** the level loads
**Then** `session.levelObjective` = `'clear'`; top strip shows "Level X — Grassland"
**And** the objective behaves exactly as implemented in Story 4.3

**AC7 — Contract tests pass:**
**Given** new delta types WaveStartedDelta and WaveCompleteDelta are added
**When** `tests/contract/net-protocol.test.ts` runs
**Then** both types pass serialize → deserialize round-trip

---

## Tasks / Subtasks

- [ ] T1: shared-types/session.ts — extend SessionState (AC1, AC2)
  - [ ] T1.1: Add `levelObjective: 'clear' | 'survive-waves'` to `SessionState` (default `'clear'`)
  - [ ] T1.2: Add `waveIndex: number` (0 = not in waves / between levels; 1+ = active wave number)
  - [ ] T1.3: Add `totalWaves: number` (0 = N/A for Clear; N = total wave count for Survive)
  - [ ] T1.4: Update `createEmptyGameState()` in GameRoom.ts to include these fields:
    `levelObjective: 'clear', waveIndex: 0, totalWaves: 0`

- [ ] T2: net-protocol — add wave delta types (AC7)
  - [ ] T2.1: Add `WaveStartedDelta = { type: 'wave:started'; waveIndex: number; totalWaves: number }`
  - [ ] T2.2: Add `WaveCompleteDelta = { type: 'wave:complete'; waveIndex: number }`
  - [ ] T2.3: Add both to `DeltaEventMsg` union (before the `default` exhaustiveness guard)
  - [ ] T2.4: In `apply-delta.ts`: add `case 'wave:started'` to update `session.waveIndex` in mirror state
  - [ ] T2.5: In `apply-delta.ts`: add `case 'wave:complete'` as a passthrough (no state mutation needed)
  - [ ] T2.6: Update `tests/contract/net-protocol.test.ts`: add two serialize→deserialize round-trip tests

- [ ] T3: game-rules/balance.ts — add wave constants (AC2, AC3)
  - [ ] T3.1: Add `WAVE_COUNTS: Record<'early' | 'mid' | 'late', number> = { early: 2, mid: 3, late: 3 }`
    (only 'mid' is used in alpha; others defined for completeness)
  - [ ] T3.2: Add `WAVE_PAUSE_MS = 2500` — pause between waves in ms
  - [ ] T3.3: Add `WAVE_ENEMY_SCALE = [0.7, 0.85, 1.0] as const`
    — per-wave multiplier applied to `getEnemyCount(playerCount, tier)` result

- [ ] T4: GameRoom.ts — wave fields and spawnWave() (AC2, AC3)
  - [ ] T4.1: Add private fields:
    ```
    private levelObjective: 'clear' | 'survive-waves' = 'clear';
    private waveIndex = 0;
    private totalWaves = 0;
    private wavePauseUntil = 0;  // epoch ms; 0 = not paused
    ```
  - [ ] T4.2: Import `WAVE_COUNTS, WAVE_PAUSE_MS, WAVE_ENEMY_SCALE` from `game-rules`
  - [ ] T4.3: Add `private spawnWave(waveNum: number, tier: 'early' | 'mid' | 'late', levelIndex: number): void`
    (see Dev Notes for full implementation)
  - [ ] T4.4: Modify `loadLevel()` (added by Story 4.3): replace the final `spawnEnemies` call
    with objective-branched logic (see Dev Notes)
  - [ ] T4.5: Replace the level-clear tick block (added by Story 4.3) with the wave-aware branched block
    (see Dev Notes for full tick pseudocode)
  - [ ] T4.6: Reset wave state in `loadLevel()` when entering a Clear level (Clear levels set
    `levelObjective = 'clear'`, `waveIndex = 0`, `totalWaves = 0`, `wavePauseUntil = 0`)

- [ ] T5: DungeonScreen.tsx — objective label and wave counter (AC1, AC2, AC6)
  - [ ] T5.1: Replace the right-side top strip label (currently "Level X — Grassland" from 4.3)
    with objective-aware rendering (see Dev Notes)
  - [ ] T5.2: Add center wave counter `"Wave {waveIndex} / {totalWaves}"` visible only during
    survive-waves phase (when `levelObjective === 'survive-waves'` and `waveIndex > 0`)
  - [ ] T5.3: Handle wave:started delta in `latestTransientDelta` effect if a flash/notification
    is desired (optional; label update via gameState is sufficient)

- [ ] T6: Verify and finalize
  - [ ] T6.1: Run `npm run typecheck --workspace=packages/shared-types`
  - [ ] T6.2: Run `npm run typecheck --workspace=packages/net-protocol`
  - [ ] T6.3: Run `npm run typecheck --workspace=packages/game-rules`
  - [ ] T6.4: Run `npm run typecheck --workspace=apps/simulation-server`
  - [ ] T6.5: Run `npm run typecheck --workspace=apps/host-client`
  - [ ] T6.6: Run `npm test --workspace=tests` (all 222+ tests must pass)

---

## Dev Notes

### What Story 4.3 Left in Place (Prerequisites)

After 4.3 is done, `GameRoom.ts` has:
- `private loadLevel(index: number): void` — clears enemies/essence/victoryTrigger, auto-revives downed/spirit players, teleports to DUNGEON_SPAWN_POSITIONS, sets `session.levelIndex`, then:
  - If `index >= 4`: boss placeholder (no enemies, victoryTriggerBody)
  - Else: `const tier = index === 1 ? 'early' : index === 2 ? 'mid' : 'late'; this.spawnEnemies(tier, index);`
- `private spawnEnemies(tier, levelIndex)` — uses `getEnemyCount(playerCount, tier)` and `createRng(runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8)))`, enemy ids `enemy-L{levelIndex}-{i}`, x=`600 + rng()*1120`, y=`200 + rng()*680`
- Tick block: runs failure check first, then `enemies.length > 0 && enemies.every(e => !e.isAlive)` → `level:complete` → `loadLevel(next)` → broadcast snapshot
- `session.levelIndex` in top strip via DungeonScreen

The `DungeonScreen.tsx` top strip right label reads:
```tsx
Level {gameState.session.levelIndex} — Grassland
```

### T1: SessionState Fields

Add to `packages/shared-types/src/session.ts`:
```typescript
export interface SessionState {
  roomId: string;
  hostId: string;
  phase: 'lobby' | 'hub' | 'dungeon' | 'post-run';
  playerCount: number;
  maxPlayers: number;
  runSeed: number;
  levelIndex: number;
  // Story 4.4 additions
  levelObjective: 'clear' | 'survive-waves';
  waveIndex: number;    // 0 = not in waves; 1+ = current wave number
  totalWaves: number;   // 0 = not applicable; N = total waves for this level
}
```

Update `createEmptyGameState()` in GameRoom.ts to include:
```typescript
session: {
  ...existing fields...
  levelObjective: 'clear',
  waveIndex: 0,
  totalWaves: 0,
}
```

### T2: Wire Delta Types

In `packages/net-protocol/src/messages/server-to-host.ts`, add before `DeltaEventMsg`:
```typescript
export type WaveStartedDelta = {
  type: 'wave:started';
  waveIndex: number;
  totalWaves: number;
};

export type WaveCompleteDelta = {
  type: 'wave:complete';
  waveIndex: number;
};
```

Add both to `DeltaEventMsg` union. The `default: never` guard in `apply-delta.ts` will enforce this — TypeScript compile error if you forget.

In `packages/net-protocol/src/apply-delta.ts`, add cases:
```typescript
case 'wave:started':
  return {
    ...state,
    session: { ...state.session, waveIndex: evt.waveIndex, totalWaves: evt.totalWaves },
  };
case 'wave:complete':
  return state;  // ponytail: transient; next wave:started updates waveIndex; snapshot reconciles
```

The `wave:started` case is important: between snapshots (every 5s), the host mirror state must reflect the current wave number so the counter doesn't lag.

### T3: Balance Constants

In `packages/game-rules/src/balance.ts`, add after the essence constants:
```typescript
// ── Survive the Waves ──────────────────────────────────────────────────────────
// Wave counts per level tier. Only 'mid' is used in alpha (Level 2 = Survive the Waves).
export const WAVE_COUNTS: Record<'early' | 'mid' | 'late', number> = {
  early: 2,  // unused in alpha (Level 1 = Clear)
  mid:   3,
  late:  3,  // unused in alpha (Level 3 = Clear)
};
// Pause between waves in ms
export const WAVE_PAUSE_MS = 2500;
// Per-wave enemy count multiplier (wave 0-indexed into this array)
// Wave 1: 70%, Wave 2: 85%, Wave 3: 100% of getEnemyCount(playerCount, tier)
export const WAVE_ENEMY_SCALE = [0.7, 0.85, 1.0] as const;
```

Export all three from `packages/game-rules/src/index.ts`.

### T4: spawnWave() Implementation

```typescript
private spawnWave(waveNum: number, tier: 'early' | 'mid' | 'late', levelIndex: number): void {
  // Clear dead bodies from prior wave (gameState.enemies still contains isAlive=false entries)
  for (const enemy of this.gameState.enemies) {
    if (!enemy.isAlive) {
      const body = this.enemyBodies.get(enemy.id);
      if (body) {
        this.physicsWorld.destroyBody(body);
        this.enemyBodies.delete(enemy.id);
      }
      this.enemyAttackCooldowns.delete(enemy.id);
    }
  }
  this.gameState.enemies = this.gameState.enemies.filter(e => e.isAlive);
  // (should be empty — run failure fires before wave complete when all alive — but safe guard)

  // Compute count: base × per-wave scale
  const baseCount = getEnemyCount(this.gameState.players.length, tier);
  const scaleIndex = Math.min(waveNum - 1, WAVE_ENEMY_SCALE.length - 1);
  const count = Math.ceil(baseCount * WAVE_ENEMY_SCALE[scaleIndex]);

  // Deterministic per-wave RNG stream
  // Wave seeding extends 4.3's level seeding: levelIndex << 8 | waveNum << 4
  const waveRng = createRng(
    this.gameState.session.runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8) | (waveNum << 4))
  );

  const difficulty = this.gameState.session.difficulty ?? DifficultyTier.EASY;

  for (let i = 0; i < count; i++) {
    const id = `enemy-L${levelIndex}-W${waveNum}-${i}`;
    // Right-half spawn: keeps enemies away from player entry (x≈240-360, y≈420-600)
    const x = 1200 + waveRng() * 650;  // 1200–1850
    const y = 100  + waveRng() * 880;  // 100–980
    const enemy: EnemyState = {
      id,
      type: EnemyType.GRUNT,
      x, y,
      hp: 60, maxHp: 60,
      difficultyTier: difficulty,
      isAlive: true,
      fsmState: EnemyFSMState.IDLE,
      attackCooldownTicks: 0,
    };
    this.gameState.enemies.push(enemy);
    const body = createEnemyBody(this.physicsWorld, id, x, y);
    this.enemyBodies.set(id, body);
    this.enemyAttackCooldowns.set(id, 0);
  }

  // Advance wave tracking state
  this.waveIndex = waveNum;
  this.gameState.session.waveIndex = waveNum;
  this.wavePauseUntil = 0;

  this.broadcast(EventNames.DELTA, {
    type: 'wave:started' as const,
    waveIndex: waveNum,
    totalWaves: this.totalWaves,
  } satisfies DeltaEventMsg);

  logger.info({ roomId: this.roomId, levelIndex, waveNum, count, tier }, 'wave started');
}
```

**Key: RNG Seed Orthogonality.** Story 4.3 uses `OFFSET_ENEMY_SPAWN | (levelIndex << 8)` for Clear levels:
- Level 1 Clear: `0x03 | 0x100 = 0x103`
- Level 3 Clear: `0x03 | 0x300 = 0x303`

Wave seeding adds `waveNum << 4`:
- Level 2 Wave 1: `0x03 | 0x200 | 0x10 = 0x213`
- Level 2 Wave 2: `0x03 | 0x200 | 0x20 = 0x223`
- Level 2 Wave 3: `0x03 | 0x200 | 0x30 = 0x233`

All four are distinct. No new OFFSET constant needed.

### T4: loadLevel() Modification

Find the last else-branch in `loadLevel()` (from 4.3):
```typescript
// 4.3 code to REPLACE:
const tier = index === 1 ? 'early' : index === 2 ? 'mid' : 'late';
this.spawnEnemies(tier, index);
```

Replace with:
```typescript
// 4.4: objective routing
if (index === 2) {
  this.levelObjective = 'survive-waves';
  this.totalWaves = WAVE_COUNTS['mid'];
  this.waveIndex = 0;
  this.wavePauseUntil = 0;
  this.gameState.session.levelObjective = 'survive-waves';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = this.totalWaves;
  this.spawnWave(1, 'mid', index);  // wave 1 spawns immediately
} else {
  this.levelObjective = 'clear';
  this.gameState.session.levelObjective = 'clear';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = 0;
  const tier = index === 1 ? 'early' : 'late';
  this.spawnEnemies(tier, index);
}
```

Also update `createEmptyGameState()` to initialize the three new session fields.

### T4: Tick Block Replacement

Find the level-clear tick block from 4.3 (search for `'level:complete'` in the dungeon phase section). Replace the entire block with:

```typescript
// ── Level clear / wave objective check ───────────────────────────────────────
if (this.gameState.session.phase === 'dungeon') {
  const enemies = this.gameState.enemies;
  const allEnemiesDead = enemies.length > 0 && enemies.every(e => !e.isAlive);

  if (this.levelObjective === 'survive-waves') {
    // Wave cleared — fire wave:complete, then either schedule next wave or finish level
    if (allEnemiesDead && this.wavePauseUntil === 0 && this.waveIndex > 0) {
      const completedWave = this.waveIndex;
      this.broadcast(EventNames.DELTA, {
        type: 'wave:complete' as const,
        waveIndex: completedWave,
      } satisfies DeltaEventMsg);

      if (completedWave >= this.totalWaves) {
        // All waves cleared → level:complete, same flow as Clear objective
        const levelIndex = this.gameState.session.levelIndex;
        this.broadcast(EventNames.DELTA, {
          type: 'level:complete' as const,
          levelIndex,
        } satisfies DeltaEventMsg);
        const nowWaveClear = Date.now();
        for (const player of this.gameState.players) {
          if (player.isDown) {
            player.reviveTimerExpiresAt = nowWaveClear + getReviveWindowMs(player.downCount);
          }
        }
        this.loadLevel(levelIndex + 1);
        this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
        logger.info({ roomId: this.roomId, levelIndex, waves: completedWave }, 'survive-waves level complete');
      } else {
        // More waves remain — schedule pause then spawn next wave
        this.wavePauseUntil = Date.now() + WAVE_PAUSE_MS;
        logger.info({ roomId: this.roomId, completedWave, nextWave: completedWave + 1 }, 'wave cleared — pausing before next wave');
      }
    }

    // Spawn next wave when pause has elapsed
    if (this.wavePauseUntil > 0 && Date.now() >= this.wavePauseUntil) {
      this.wavePauseUntil = 0;
      const nextWave = this.waveIndex + 1;
      this.spawnWave(nextWave, 'mid', this.gameState.session.levelIndex);
      this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
    }
  } else {
    // Clear objective (original 4.3 logic, unchanged)
    if (allEnemiesDead) {
      const levelIndex = this.gameState.session.levelIndex;
      this.broadcast(EventNames.DELTA, {
        type: 'level:complete' as const,
        levelIndex,
      } satisfies DeltaEventMsg);
      const nowClear = Date.now();
      for (const player of this.gameState.players) {
        if (player.isDown) {
          player.reviveTimerExpiresAt = nowClear + getReviveWindowMs(player.downCount);
        }
      }
      this.loadLevel(levelIndex + 1);
      this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
      logger.info({ roomId: this.roomId, levelIndex }, 'level clear — loading next level');
    }
  }
}
```

**Tick ordering stays intact:** run failure check fires BEFORE this block (so all-in-spirit-form during a wave ends the run, not the wave). The wave pause check (`wavePauseUntil`) inside the survive-waves branch prevents re-triggering `wave:complete` on the same dead-enemy state across ticks.

**The boss placeholder victory check (from 4.3) follows unchanged** after this block.

### T5: DungeonScreen.tsx Top Strip Change

After 4.3, the right div in the top strip reads:
```tsx
Level {gameState.session.levelIndex} — Grassland
```

Replace the entire right-side div with:
```tsx
{/* Right: level + objective label */}
<div style={{
  marginLeft: 'auto',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 2,
}}>
  {gameState.session.levelObjective === 'survive-waves'
    ? `Level ${gameState.session.levelIndex} — Survive: ${gameState.session.totalWaves} Waves`
    : `Level ${gameState.session.levelIndex} — Grassland`
  }
  {gameState.session.levelObjective === 'survive-waves' && gameState.session.waveIndex > 0 && (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>
      Wave {gameState.session.waveIndex} / {gameState.session.totalWaves}
    </span>
  )}
</div>
```

The wave counter appears as a sub-label under the objective text, aligned right. Both are visible at couch distance within the 48px top strip (xs = 11px minimum — acceptable for supplementary info; the main label is sm = 14px).

If `gameState.session.levelObjective` is undefined (host connected during in-progress level from pre-4.4 code), fall back to `|| 'clear'` via optional chaining: `gameState.session.levelObjective ?? 'clear'`.

### Contract Test Addition

In `tests/contract/net-protocol.test.ts`, add after existing round-trip tests:
```typescript
describe('WaveStartedDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: DeltaEventMsg = { type: 'wave:started', waveIndex: 2, totalWaves: 3 };
    expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
  });
});

describe('WaveCompleteDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: DeltaEventMsg = { type: 'wave:complete', waveIndex: 1 };
    expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
  });
});
```

### Critical: `difficulty` in SessionState

The `spawnWave()` pseudocode uses `this.gameState.session.difficulty ?? DifficultyTier.EASY`. The current `SessionState` (`packages/shared-types/src/session.ts`) does **not** have a `difficulty` field — TypeScript strict mode will error.

Resolution options (in order of preference):
1. If Story 4.2 added `difficulty: DifficultyTier` to `SessionState` before this story runs → use it directly.
2. If Story 4.2 stores difficulty as a private GameRoom field only → read `this.difficulty` (private field) instead of `this.gameState.session.difficulty`.
3. If difficulty is not yet wired → hardcode `DifficultyTier.EASY` with a `// ponytail: wire difficulty from session when 4.2 is done` comment.

Also: `WAVE_ENEMY_SCALE[scaleIndex]` is a `readonly [number, number, number]` tuple indexed at runtime — TypeScript may flag it as `number | undefined`. Use `WAVE_ENEMY_SCALE[scaleIndex] ?? 1.0` to satisfy strict mode.

### Current DungeonScreen.tsx label (pre-4.3)

The current DungeonScreen.tsx (at E3 end state) shows a hardcoded `"Clear"` label, **not** `"Level X — Grassland"`. Story 4.3 must replace this with the level-aware label before Story 4.4 can extend it. This story's T5.1 assumes 4.3 is done and the label already reads `Level {gameState.session.levelIndex} — Grassland`.

### What NOT to Re-Implement

- `getEnemyCount(playerCount, tier)` — already in game-rules/balance.ts, imported in GameRoom.ts
- `EnemyType.GRUNT`, `DifficultyTier`, `EnemyFSMState` — already imported in GameRoom.ts
- `createEnemyBody()` — already imported from physics/world.ts
- `OFFSET_ENEMY_SPAWN` — already imported in GameRoom.ts
- `getReviveWindowMs()` — already imported in GameRoom.ts
- `SnapshotMsg` — already imported in GameRoom.ts
- The POI contact, essence contact, player movement, enemy AI, ability dispatch, melee, revive, spirit form, and cooldown expiry blocks in tick() — **do not touch any of these**
- `loadLevel()` infrastructure (enemy clear, essence clear, victory trigger clear, player revive, teleport) — only modify the final spawn decision

### Dependency: Story 4.3 Must Be Done First

This story modifies `loadLevel()` and the tick clear block that 4.3 creates. If 4.3 is not done:
1. `loadLevel()` doesn't exist — the dev must implement the full multi-level loop from 4.3's dev notes first
2. The current tick block ends the run immediately after level:complete — wave logic cannot be bolted on
3. The top strip level label doesn't exist in DungeonScreen — 4.3's label must be present to extend

**Do not implement 4.4 before 4.3 is done and tested.**

### Ownership Scope Note

This story legitimately crosses three ownership areas:
- Protocol Architect (T1, T2): `shared-types/session.ts` and `net-protocol` changes
- Simulation Engineer (T3, T4): `game-rules/balance.ts` and `GameRoom.ts` wave logic
- Host Experience Engineer (T5): `DungeonScreen.tsx` objective display

This is the expected pattern for E4 stories (same as 4.3). Cross-context approval is implicit in the epic plan. No task splitting required.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

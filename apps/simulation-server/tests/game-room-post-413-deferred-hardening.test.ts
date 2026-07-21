/**
 * Tests for Story 4.14 — closing the 4 deferred findings from Stories 4.11,
 * 4.12, and 4.13's code reviews (D-4.11-A, D-4.11-B, D1-4.12, D1-4.13).
 *
 * GameRoom isn't instantiable outside a live Colyseus room, so each scenario
 * mirrors the relevant ordering/cleanup logic directly (same pattern as
 * game-room-post-410-deferred-hardening.test.ts and
 * game-room-level-transition-hp.test.ts). Task 4 (mobile VotePopup timeout)
 * has no automated test per the story's Non-goals — verified by code trace.
 */
import { describe, it, expect } from 'vitest';

// Mirrors loadLevel's level-2 branch ordering (AC1): levelIndex commits only
// after spawnWave succeeds.
function simulateLevel2Branch(state: { levelIndex: number }, spawnWave: () => void): void {
  spawnWave();
  state.levelIndex = 2;
}

// Mirrors loadLevel's default (clear) branch ordering (AC1): levelIndex
// commits only after spawnEnemies succeeds.
function simulateDefaultBranch(state: { levelIndex: number }, index: number, spawnEnemies: () => void): void {
  spawnEnemies();
  state.levelIndex = index;
}

describe('GameRoom loadLevel level-2 branch — levelIndex commits only after spawnWave succeeds (Story 4.14, D-4.11-A)', () => {
  it('does NOT update levelIndex when spawnWave throws', () => {
    const state = { levelIndex: 1 };
    expect(() => simulateLevel2Branch(state, () => { throw new Error('spawnWave failed'); })).toThrow();
    expect(state.levelIndex).toBe(1);
  });

  it('updates levelIndex to 2 when spawnWave succeeds', () => {
    const state = { levelIndex: 1 };
    simulateLevel2Branch(state, () => {});
    expect(state.levelIndex).toBe(2);
  });
});

describe('GameRoom loadLevel default branch — levelIndex commits only after spawnEnemies succeeds (Story 4.14, D-4.11-A)', () => {
  it('does NOT update levelIndex when spawnEnemies throws', () => {
    const state = { levelIndex: 2 };
    expect(() => simulateDefaultBranch(state, 3, () => { throw new Error('spawnEnemies failed'); })).toThrow();
    expect(state.levelIndex).toBe(2);
  });

  it('updates levelIndex to the target level when spawnEnemies succeeds', () => {
    const state = { levelIndex: 2 };
    simulateDefaultBranch(state, 3, () => {});
    expect(state.levelIndex).toBe(3);
  });
});

// Mirrors resetToHub's boss-body/arena-wall cleanup block (AC2).
interface MirroredPhysicsBody { id: string }

function simulateResetToHubBossCleanup(
  state: { bossBody: MirroredPhysicsBody | null; arenaWallBodies: MirroredPhysicsBody[] },
  destroyBody: (body: MirroredPhysicsBody) => void,
): void {
  if (state.bossBody) {
    destroyBody(state.bossBody);
    state.bossBody = null;
  }
  for (const wall of state.arenaWallBodies) destroyBody(wall);
  state.arenaWallBodies.length = 0;
}

describe('GameRoom resetToHub — destroys boss body and arena walls (Story 4.14, D-4.11-B)', () => {
  it('destroys a non-null bossBody and sets it to null', () => {
    const bossBody: MirroredPhysicsBody = { id: 'boss' };
    const state = { bossBody, arenaWallBodies: [] as MirroredPhysicsBody[] };
    const destroyed: MirroredPhysicsBody[] = [];
    simulateResetToHubBossCleanup(state, b => destroyed.push(b));
    expect(destroyed).toEqual([bossBody]);
    expect(state.bossBody).toBeNull();
  });

  it('destroys every arenaWallBody and clears the array', () => {
    const walls: MirroredPhysicsBody[] = [{ id: 'w1' }, { id: 'w2' }];
    const expectedDestroyed = [...walls];
    const state = { bossBody: null, arenaWallBodies: walls };
    const destroyed: MirroredPhysicsBody[] = [];
    simulateResetToHubBossCleanup(state, b => destroyed.push(b));
    expect(destroyed).toEqual(expectedDestroyed);
    expect(state.arenaWallBodies).toHaveLength(0);
  });

  it('is a no-op guard when bossBody is null and arenaWallBodies is empty', () => {
    const state = { bossBody: null, arenaWallBodies: [] as MirroredPhysicsBody[] };
    const destroyed: MirroredPhysicsBody[] = [];
    simulateResetToHubBossCleanup(state, b => destroyed.push(b));
    expect(destroyed).toHaveLength(0);
    expect(state.bossBody).toBeNull();
    expect(state.arenaWallBodies).toHaveLength(0);
  });
});

// Mirrors loadLevel's corrected per-player reset-loop body (Story 4.14 adds
// the unconditional isFrozen clear alongside 4.12's unconditional hp restore).
interface MirroredPlayer {
  hp: number;
  maxHp: number;
  isDown: boolean;
  isSpirit: boolean;
  isFrozen: boolean;
  reviveTimerExpiresAt: number;
}

function applyLevelTransitionReset(player: MirroredPlayer): MirroredPlayer {
  const next = { ...player };
  if (next.isDown || next.isSpirit) {
    next.isDown = false;
    next.isSpirit = false;
    next.reviveTimerExpiresAt = 0;
  }
  next.hp = next.maxHp;
  next.isFrozen = false;
  return next;
}

describe('GameRoom.loadLevel() — clears isFrozen unconditionally on level transition (Story 4.14, D1-4.12)', () => {
  it('clears isFrozen for a frozen (disconnected) player, not down/spirit', () => {
    const result = applyLevelTransitionReset({
      hp: 50, maxHp: 100, isDown: false, isSpirit: false, isFrozen: true, reviveTimerExpiresAt: 0,
    });
    expect(result.isFrozen).toBe(false);
    expect(result.hp).toBe(100);
  });

  it('clears isFrozen for a player that is also down', () => {
    const result = applyLevelTransitionReset({
      hp: 0, maxHp: 100, isDown: true, isSpirit: false, isFrozen: true, reviveTimerExpiresAt: 12345,
    });
    expect(result.isFrozen).toBe(false);
    expect(result.isDown).toBe(false);
  });

  it('leaves isFrozen false for a player that was never frozen', () => {
    const result = applyLevelTransitionReset({
      hp: 80, maxHp: 100, isDown: false, isSpirit: false, isFrozen: false, reviveTimerExpiresAt: 0,
    });
    expect(result.isFrozen).toBe(false);
  });
});

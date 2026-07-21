/**
 * Tests for GameRoom.tick()'s generic level-clear guard (Story 4.10, D-4.9-A).
 *
 * Mirrors the `else` branch of tick()'s level-clear check — the class isn't
 * instantiable outside a live Colyseus room, so we replicate the guard
 * condition directly (same pattern as game-room-host-join.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { DifficultyTier, EnemyFSMState, EnemyType } from 'shared-types';
import type { EnemyState } from 'shared-types';

const BOSS_LEVEL_INDEX = 4;

/** Mirrors tick()'s `else` branch condition (non-survive-waves levels). */
function levelClearFires(levelIndex: number, bondMomentNextLevel: number, enemies: EnemyState[]): boolean {
  const allEnemiesDead = enemies.length > 0 && enemies.every((e) => !e.isAlive);
  return levelIndex !== BOSS_LEVEL_INDEX && bondMomentNextLevel === -1 && allEnemiesDead;
}

function makeEnemy(isAlive: boolean): EnemyState {
  return {
    id: 'e1',
    type: EnemyType.GRASSLAND_ADD,
    x: 0,
    y: 0,
    hp: isAlive ? 10 : 0,
    maxHp: 10,
    difficultyTier: DifficultyTier.HARD,
    isAlive,
    fsmState: EnemyFSMState.IDLE,
    attackCooldownTicks: 0,
    statusEffects: [],
  };
}

describe('GameRoom.tick() — generic level-clear guard excludes boss level (Story 4.10, D-4.9-A)', () => {
  it('does NOT fire at the boss level when all enemies (adds) are dead but boss survives', () => {
    expect(levelClearFires(BOSS_LEVEL_INDEX, -1, [makeEnemy(false), makeEnemy(false)])).toBe(false);
  });

  it('still fires at non-boss clear levels (1) when all enemies are dead', () => {
    expect(levelClearFires(1, -1, [makeEnemy(false)])).toBe(true);
  });

  it('still fires at non-boss clear levels (3) when all enemies are dead', () => {
    expect(levelClearFires(3, -1, [makeEnemy(false)])).toBe(true);
  });

  it('does not fire at the boss level even if enemies array is empty', () => {
    expect(levelClearFires(BOSS_LEVEL_INDEX, -1, [])).toBe(false);
  });
});

/**
 * Mirrors loadLevel's boss-branch `allBondsAtBossStart` computation (Story 5.8, D-5.7-C;
 * updated to `>=` by Story 5.9's code review — assignBond still pairs against the live roster
 * each bond-moment, so a roster that grows between bond-assignment attempts can validly earn
 * more bonds than a frozen snapshot anticipated; those extra bonds must still count).
 * GameRoom isn't instantiable outside a live Colyseus room, so the formula is replicated
 * directly (same pattern as the level-clear guard above).
 */
function allBondsAtBossStart(activeBondCount: number, playerCount: number): boolean {
  const maxAchievableBonds = playerCount >= 2
    ? Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)
    : 0;
  return activeBondCount >= maxAchievableBonds && maxAchievableBonds > 0;
}

describe('GameRoom.loadLevel() — allBondsAtBossStart is player-count-aware (Story 5.8, D-5.7-C)', () => {
  it('is true for a 2-player session with its 1 achievable bond assigned', () => {
    expect(allBondsAtBossStart(1, 2)).toBe(true);
  });

  it('is false for a 2-player session with 0 bonds', () => {
    expect(allBondsAtBossStart(0, 2)).toBe(false);
  });

  it('still requires 3 distinct bonds for a 3-player session (unchanged)', () => {
    expect(allBondsAtBossStart(1, 3)).toBe(false);
    expect(allBondsAtBossStart(2, 3)).toBe(false);
    expect(allBondsAtBossStart(3, 3)).toBe(true);
  });

  it('still requires 3 distinct bonds for sessions larger than 3 players (unchanged)', () => {
    expect(allBondsAtBossStart(2, 8)).toBe(false);
    expect(allBondsAtBossStart(3, 8)).toBe(true);
  });

  it('caps at 3 for a 4-player session even though 4 players allow 6 distinct pairs', () => {
    expect(allBondsAtBossStart(2, 4)).toBe(false);
    expect(allBondsAtBossStart(3, 4)).toBe(true);
  });

  it('is false for 0- or 1-player sessions regardless of activeBonds length', () => {
    expect(allBondsAtBossStart(0, 0)).toBe(false);
    expect(allBondsAtBossStart(0, 1)).toBe(false);
  });

  it('is true when activeBonds exceeds maxAchievableBonds (code review finding, Story 5.9)', () => {
    // A roster that grew mid-run can earn more bonds than a frozen snapshot anticipated —
    // exceeding the ceiling must still count as "all achievable bonds active", not fail.
    expect(allBondsAtBossStart(2, 2)).toBe(true);
  });
});

/**
 * Mirrors the bondEligiblePlayerCount snapshot resolution in loadLevel's boss branch
 * (Story 5.9, D-5.8-A; updated by Story 5.9's code review): playerCount must come from the
 * roster snapshotted at first bond assignment, not the live roster at boss-start. Checks
 * `!== -1` (not `>= 2`) — 0 or 1 is a legitimate captured snapshot (e.g. a solo-started run),
 * not "never snapshotted"; falling back to the live count for a captured 0/1 would reintroduce
 * the exact stale-read bug this story closes.
 */
function resolvePlayerCountForBondCheck(bondEligiblePlayerCount: number, livePlayerCount: number): number {
  return bondEligiblePlayerCount !== -1 ? bondEligiblePlayerCount : livePlayerCount;
}

describe('GameRoom — bondEligiblePlayerCount snapshot resolution (Story 5.9, D-5.8-A)', () => {
  it('uses the snapshot over the live roster once a snapshot exists', () => {
    expect(resolvePlayerCountForBondCheck(2, 3)).toBe(2);
  });

  it('fixes the D-5.8-A scenario: a late-joining 3rd player no longer inflates maxAchievableBonds', () => {
    // 2-player session assigns its 1 achievable bond; a 3rd player joins before boss start.
    const resolvedPlayerCount = resolvePlayerCountForBondCheck(2, 3);
    expect(allBondsAtBossStart(1, resolvedPlayerCount)).toBe(true); // was false pre-fix (live count = 3)
  });

  it('falls back to the live count only when no snapshot was ever captured (-1 sentinel)', () => {
    expect(resolvePlayerCountForBondCheck(-1, 3)).toBe(3);
  });

  it('unchanged for a stable roster (common case): snapshot equals live count', () => {
    expect(resolvePlayerCountForBondCheck(3, 3)).toBe(3);
  });

  it('uses a captured 0 or 1 snapshot rather than falling back to a grown live roster (code review finding, Story 5.9)', () => {
    // A solo-started run (resolveVoteIfComplete has no >=2 floor) can snapshot at 0 or 1 —
    // that must still count as "captured", or a later-joining 2nd/3rd player reintroduces
    // the exact D-5.8-A stale-live-read bug this story exists to close.
    expect(resolvePlayerCountForBondCheck(0, 3)).toBe(0);
    expect(resolvePlayerCountForBondCheck(1, 3)).toBe(1);
  });
});

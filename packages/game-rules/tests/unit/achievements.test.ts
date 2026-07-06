import { describe, it, expect } from 'vitest';
import { GrasslandAchievement, DifficultyTier } from 'shared-types';
import type { GameState, SessionState, PlayerState } from 'shared-types';
import { evaluateGrasslandAchievements } from '../../src/systems/achievements.js';
import { BOSS_FAST_CLEAR_MS } from '../../src/balance.js';

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    roomId: 'test', hostId: 'h', phase: 'dungeon',
    playerCount: 2, maxPlayers: 8, runSeed: 0,
    levelIndex: 4, difficulty: DifficultyTier.NORMAL,
    levelObjective: 'clear', waveIndex: 0, totalWaves: 0,
    bossLevelStartedAt: 0,
    anyPlayerDownedDuringBoss: false,
    allBondsAtBossStart: false,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p0', displayName: 'P0', class: null,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionColor: 'red' as any, downCount: 0,
    nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0,
    ...overrides,
  };
}

function makeState(
  sessionOverrides: Partial<SessionState> = {},
  players: PlayerState[] = [makePlayer()],
): GameState {
  return {
    session: makeSession(sessionOverrides),
    players,
    enemies: [], activeBonds: [], essenceDrops: [],
    tick: 0, floorLayout: null, runProposal: null, boss: null,
  };
}

const NOW = 1_000_000;

describe('evaluateGrasslandAchievements — NoDeath', () => {
  it('true when all players have downCount === 0', () => {
    const state = makeState({}, [makePlayer({ id: 'p0', downCount: 0 }), makePlayer({ id: 'p1', downCount: 0 })]);
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toContain(GrasslandAchievement.NoDeath);
  });

  it('false when any player has downCount > 0', () => {
    const state = makeState({}, [makePlayer({ id: 'p0', downCount: 1 }), makePlayer({ id: 'p1', downCount: 0 })]);
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.NoDeath);
  });
});

describe('evaluateGrasslandAchievements — FastBoss', () => {
  it('true when bossDefeatedAt - bossLevelStartedAt <= BOSS_FAST_CLEAR_MS', () => {
    const startedAt = NOW - BOSS_FAST_CLEAR_MS;
    const state = makeState({ bossLevelStartedAt: startedAt });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toContain(GrasslandAchievement.FastBoss);
  });

  it('false when time exceeds BOSS_FAST_CLEAR_MS', () => {
    const startedAt = NOW - BOSS_FAST_CLEAR_MS - 1;
    const state = makeState({ bossLevelStartedAt: startedAt });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.FastBoss);
  });
});

describe('evaluateGrasslandAchievements — AllBondsActive', () => {
  it('true when allBondsAtBossStart === true', () => {
    const state = makeState({ allBondsAtBossStart: true });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toContain(GrasslandAchievement.AllBondsActive);
  });

  it('false when allBondsAtBossStart === false', () => {
    const state = makeState({ allBondsAtBossStart: false });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.AllBondsActive);
  });
});

describe('evaluateGrasslandAchievements — HardCleared', () => {
  it('true when difficulty === DifficultyTier.HARD', () => {
    const state = makeState({ difficulty: DifficultyTier.HARD });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toContain(GrasslandAchievement.HardCleared);
  });

  it('false when difficulty === DifficultyTier.EASY', () => {
    const state = makeState({ difficulty: DifficultyTier.EASY });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.HardCleared);
  });

  it('false when difficulty === DifficultyTier.NORMAL', () => {
    const state = makeState({ difficulty: DifficultyTier.NORMAL });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.HardCleared);
  });
});

describe('evaluateGrasslandAchievements — VigilHeld', () => {
  it('true when anyPlayerDownedDuringBoss === true', () => {
    const state = makeState({ anyPlayerDownedDuringBoss: true });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toContain(GrasslandAchievement.VigilHeld);
  });

  it('false when anyPlayerDownedDuringBoss === false', () => {
    const state = makeState({ anyPlayerDownedDuringBoss: false });
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).not.toContain(GrasslandAchievement.VigilHeld);
  });
});

describe('evaluateGrasslandAchievements — array integrity', () => {
  it('no achievement appears twice', () => {
    const state = makeState(
      { allBondsAtBossStart: true, difficulty: DifficultyTier.HARD, anyPlayerDownedDuringBoss: true, bossLevelStartedAt: NOW - 1000 },
      [makePlayer({ downCount: 0 })],
    );
    const result = evaluateGrasslandAchievements(state, NOW);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('empty array returned when no achievements met', () => {
    const state = makeState(
      {
        bossLevelStartedAt: NOW - BOSS_FAST_CLEAR_MS - 999_999,
        allBondsAtBossStart: false,
        difficulty: DifficultyTier.EASY,
        anyPlayerDownedDuringBoss: false,
      },
      [makePlayer({ downCount: 2 })],
    );
    const result = evaluateGrasslandAchievements(state, NOW);
    expect(result).toEqual([]);
  });
});

/**
 * Tests for Story 4.11 — closing the 5 deferred findings from Story 4.10's
 * code review (D-4.10-A through D-4.10-E).
 *
 * GameRoom isn't instantiable outside a live Colyseus room, so each scenario
 * mirrors the relevant catch-block/ordering logic directly (same pattern as
 * game-room-host-join.test.ts and game-room-level-clear-guard.test.ts).
 */
import { describe, it, expect, vi } from 'vitest';
import { DifficultyTier } from 'shared-types';
import type { RunProposal } from 'shared-types';

const BOSS_LEVEL_INDEX = 4;

// Mirrors the CONTINUE handler's catch block (AC1).
function simulateContinueCatch(
  nextLevel: number,
  loadLevel: (level: number) => void,
): { bondMomentNextLevel: number } {
  const state = { bondMomentNextLevel: -1 as number };
  state.bondMomentNextLevel = nextLevel;
  const armed = nextLevel;
  state.bondMomentNextLevel = -1;
  try {
    loadLevel(armed);
  } catch {
    state.bondMomentNextLevel = armed;
  }
  return state;
}

// Mirrors startDungeon's catch block (AC2, AC3).
function simulateStartDungeonCatch(
  previousPhase: string,
  previousProposal: RunProposal | null,
  proposal: RunProposal | null,
  setup: () => void,
  broadcastDelta: (name: string) => void,
  broadcastSnapshot: () => void,
): { phase: string; runProposal: RunProposal | null } {
  const state = { phase: previousPhase, runProposal: previousProposal };
  state.phase = 'dungeon';
  state.runProposal = null;
  try {
    setup();
  } catch {
    state.phase = previousPhase;
    state.runProposal = previousProposal;
    return state;
  }
  if (proposal) broadcastDelta('run:starting');
  broadcastSnapshot();
  return state;
}

// Mirrors loadLevel's boss-branch ordering (AC4). `state.levelIndex` is only
// assigned after `construct()` returns — a throw from construct() propagates
// to the caller (as it does in the real loadLevel, whose try/catch lives in
// its callers, not in loadLevel itself) leaving levelIndex untouched.
function simulateBossBranch(state: { levelIndex: number }, construct: () => void): void {
  construct();
  state.levelIndex = BOSS_LEVEL_INDEX;
}

describe('GameRoom CONTINUE handler — retry-ability on loadLevel failure (Story 4.11, D-4.10-A)', () => {
  it('restores bondMomentNextLevel to the failed level, not -1', () => {
    const result = simulateContinueCatch(2, () => {
      throw new Error('loadLevel failed');
    });
    expect(result.bondMomentNextLevel).toBe(2);
  });

  it('leaves bondMomentNextLevel at -1 when loadLevel succeeds', () => {
    const result = simulateContinueCatch(2, () => {});
    expect(result.bondMomentNextLevel).toBe(-1);
  });
});

describe('GameRoom startDungeon — revert and deferred run:starting (Story 4.11, D-4.10-B/C)', () => {
  const proposal: RunProposal = { biome: 'grassland', difficulty: DifficultyTier.EASY, proposedBy: 'p1' };

  it('reverts phase and runProposal, and does not broadcast, when loadLevel(1) throws', () => {
    const broadcastDelta = vi.fn();
    const broadcastSnapshot = vi.fn();
    const result = simulateStartDungeonCatch(
      'hub', proposal, proposal,
      () => { throw new Error('loadLevel(1) failed'); },
      broadcastDelta, broadcastSnapshot,
    );
    expect(result.phase).toBe('hub');
    expect(result.runProposal).toBe(proposal);
    expect(broadcastDelta).not.toHaveBeenCalled();
    expect(broadcastSnapshot).not.toHaveBeenCalled();
  });

  it('reverts phase and runProposal when floor-layout generation throws (D-4.10-C)', () => {
    const broadcastDelta = vi.fn();
    const broadcastSnapshot = vi.fn();
    const result = simulateStartDungeonCatch(
      'hub', proposal, proposal,
      () => { throw new Error('generateFloorLayout failed'); },
      broadcastDelta, broadcastSnapshot,
    );
    expect(result.phase).toBe('hub');
    expect(result.runProposal).toBe(proposal);
    expect(broadcastDelta).not.toHaveBeenCalled();
  });

  it('reverts to the pre-call phase for the HOST_START path (no proposal), and broadcasts nothing on failure', () => {
    const broadcastDelta = vi.fn();
    const broadcastSnapshot = vi.fn();
    const result = simulateStartDungeonCatch(
      'lobby', null, null,
      () => { throw new Error('loadLevel(1) failed'); },
      broadcastDelta, broadcastSnapshot,
    );
    expect(result.phase).toBe('lobby');
    expect(result.runProposal).toBeNull();
    expect(broadcastDelta).not.toHaveBeenCalled();
  });

  it('broadcasts run:starting and snapshot on success when a proposal exists', () => {
    const broadcastDelta = vi.fn();
    const broadcastSnapshot = vi.fn();
    simulateStartDungeonCatch('hub', proposal, proposal, () => {}, broadcastDelta, broadcastSnapshot);
    expect(broadcastDelta).toHaveBeenCalledWith('run:starting');
    expect(broadcastSnapshot).toHaveBeenCalledOnce();
  });

  it('broadcasts only the snapshot (no run:starting) on success for the HOST_START path', () => {
    const broadcastDelta = vi.fn();
    const broadcastSnapshot = vi.fn();
    simulateStartDungeonCatch('lobby', null, null, () => {}, broadcastDelta, broadcastSnapshot);
    expect(broadcastDelta).not.toHaveBeenCalled();
    expect(broadcastSnapshot).toHaveBeenCalledOnce();
  });
});

describe('GameRoom loadLevel boss branch — levelIndex commits only after construction succeeds (Story 4.11, D-4.10-D)', () => {
  it('does NOT update levelIndex to BOSS_LEVEL_INDEX when boss construction throws', () => {
    const state = { levelIndex: 3 };
    expect(() => simulateBossBranch(state, () => { throw new Error('loadBossArena failed'); })).toThrow();
    expect(state.levelIndex).toBe(3);
  });

  it('updates levelIndex to BOSS_LEVEL_INDEX when boss construction succeeds', () => {
    const state = { levelIndex: 3 };
    simulateBossBranch(state, () => {});
    expect(state.levelIndex).toBe(BOSS_LEVEL_INDEX);
  });
});

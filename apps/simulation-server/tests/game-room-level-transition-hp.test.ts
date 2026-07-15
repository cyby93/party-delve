/**
 * Tests for GameRoom.loadLevel()'s unconditional full-HP restore (Story 4.12).
 *
 * GameRoom isn't instantiable outside a live Colyseus room, so the corrected
 * reset-loop's HP-assignment logic is mirrored directly (same pattern as
 * game-room-level-clear-guard.test.ts).
 */
import { describe, it, expect } from 'vitest';

interface MirroredPlayer {
  hp: number;
  maxHp: number;
  isDown: boolean;
  isSpirit: boolean;
  reviveTimerExpiresAt: number;
}

/** Mirrors loadLevel()'s corrected per-player reset-loop body (Story 4.12). */
function applyLevelTransitionReset(player: MirroredPlayer): MirroredPlayer {
  const next = { ...player };
  if (next.isDown || next.isSpirit) {
    next.isDown = false;
    next.isSpirit = false;
    next.reviveTimerExpiresAt = 0;
  }
  next.hp = next.maxHp;
  return next;
}

describe('GameRoom.loadLevel() — full HP restore on level transition (Story 4.12)', () => {
  it('restores a partial-HP survivor (not down/spirit) to maxHp', () => {
    const result = applyLevelTransitionReset({
      hp: 20,
      maxHp: 100,
      isDown: false,
      isSpirit: false,
      reviveTimerExpiresAt: 0,
    });
    expect(result.hp).toBe(100);
  });

  it('restores a down player to maxHp (not REVIVE_HP) and clears down state', () => {
    const result = applyLevelTransitionReset({
      hp: 0,
      maxHp: 100,
      isDown: true,
      isSpirit: false,
      reviveTimerExpiresAt: 12345,
    });
    expect(result.hp).toBe(100);
    expect(result.isDown).toBe(false);
    expect(result.reviveTimerExpiresAt).toBe(0);
  });

  it('restores a spirit player to maxHp and clears spirit state', () => {
    const result = applyLevelTransitionReset({
      hp: 0,
      maxHp: 100,
      isDown: false,
      isSpirit: true,
      reviveTimerExpiresAt: 6789,
    });
    expect(result.hp).toBe(100);
    expect(result.isSpirit).toBe(false);
    expect(result.reviveTimerExpiresAt).toBe(0);
  });
});

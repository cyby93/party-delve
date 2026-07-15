import { describe, it, expect } from 'vitest';
import { findSoulMendTarget, shouldCancelSoulMendChannel, reviveBySoulMend, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, REVIVE_HP } from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

const HIT_RANGE = ABILITY_HIT_RANGE_PX[PlayerClass.SPIRITCALLER][2];
const HIT_RADIUS = ABILITY_HIT_RADIUS_PX[PlayerClass.SPIRITCALLER][2];

function mockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    displayName: 'Test',
    class: PlayerClass.SPIRITCALLER,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
    statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

describe('findSoulMendTarget', () => {
  it('finds a downed ally aimed at, within range', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: HIT_RANGE, y: 0 });
    const found = findSoulMendTarget(0, 0, 1, 0, [target], HIT_RANGE, HIT_RADIUS);
    expect(found?.id).toBe('ally');
  });

  it('rejects a target that is not isDown', () => {
    const notDown = mockPlayer({ id: 'ally', isDown: false, x: HIT_RANGE, y: 0 });
    const found = findSoulMendTarget(0, 0, 1, 0, [notDown], HIT_RANGE, HIT_RADIUS);
    expect(found).toBeNull();
  });

  it('respects the range limit — a downed ally outside the aimed hit-zone is not found', () => {
    const tooFar = mockPlayer({ id: 'ally', isDown: true, x: HIT_RANGE * 3, y: 0 });
    const found = findSoulMendTarget(0, 0, 1, 0, [tooFar], HIT_RANGE, HIT_RADIUS);
    expect(found).toBeNull();
  });

  it('returns null when no downed players are given', () => {
    expect(findSoulMendTarget(0, 0, 1, 0, [], HIT_RANGE, HIT_RADIUS)).toBeNull();
  });

  it('regression (Story 3.21b): still resolves the correct isDown target when other players in the candidate set have diverged x/y (spirit) vs bodyX/bodyY', () => {
    // Neither this ability's targeting math nor its isDown-only filter reads
    // bodyX/bodyY at all — this proves the schema split (Story 3.21a/b) doesn't
    // regress Soul Mend's existing, unchanged targeting behavior.
    const wanderingSpirit = mockPlayer({ id: 'spirit-ally', isDown: false, isSpirit: true, x: 9999, y: 9999, bodyX: 0, bodyY: 0 });
    const downedTarget = mockPlayer({ id: 'ally', isDown: true, x: HIT_RANGE, y: 0, bodyX: HIT_RANGE, bodyY: 0 });
    const found = findSoulMendTarget(0, 0, 1, 0, [wanderingSpirit, downedTarget], HIT_RANGE, HIT_RADIUS);
    expect(found?.id).toBe('ally');
  });
});

describe('shouldCancelSoulMendChannel', () => {
  const maxRange = HIT_RANGE + HIT_RADIUS;

  it('cancels on no-input-timeout (liveness threshold exceeded)', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: 0, y: 0 });
    const cancel = shouldCancelSoulMendChannel(target, 0, 0, false, /* lastInput */ 0, /* now */ 200, /* livenessMs */ 150, maxRange);
    expect(cancel).toBe(true);
  });

  it('does not cancel while input keeps arriving within the liveness window', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: 0, y: 0 });
    const cancel = shouldCancelSoulMendChannel(target, 0, 0, false, /* lastInput */ 100, /* now */ 200, /* livenessMs */ 150, maxRange);
    expect(cancel).toBe(false);
  });

  it('cancels when the target is no longer down (revived by someone else, or entered spirit form)', () => {
    const noLongerDown = mockPlayer({ id: 'ally', isDown: false, x: 0, y: 0 });
    const cancel = shouldCancelSoulMendChannel(noLongerDown, 0, 0, false, 100, 200, 150, maxRange);
    expect(cancel).toBe(true);
  });

  it('cancels when the target can no longer be found (e.g. left the room)', () => {
    const cancel = shouldCancelSoulMendChannel(undefined, 0, 0, false, 100, 200, 150, maxRange);
    expect(cancel).toBe(true);
  });

  it('cancels when the caster has moved out of range of the target', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: maxRange * 3, y: 0 });
    const cancel = shouldCancelSoulMendChannel(target, 0, 0, false, 100, 200, 150, maxRange);
    expect(cancel).toBe(true);
  });

  it('cancels when the caster is incapacitated (downed/frozen/spirit), even with fresh input and a valid target in range', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: 0, y: 0 });
    const cancel = shouldCancelSoulMendChannel(target, 0, 0, /* casterIncapacitated */ true, 100, 200, 150, maxRange);
    expect(cancel).toBe(true);
  });

  it('does not cancel when target is down, in range, caster is not incapacitated, and input is fresh', () => {
    const target = mockPlayer({ id: 'ally', isDown: true, x: 10, y: 0 });
    const cancel = shouldCancelSoulMendChannel(target, 0, 0, false, 100, 200, 150, maxRange);
    expect(cancel).toBe(false);
  });
});

describe('reviveBySoulMend', () => {
  it('applies the same state transition as the existing proximity revive', () => {
    const downed = mockPlayer({ id: 'ally', isDown: true, hp: 0, reviveTimerExpiresAt: 99999 });
    const revived = reviveBySoulMend(downed, REVIVE_HP);
    expect(revived).toMatchObject({ isDown: false, isSpirit: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0 });
  });

  it('resets x/y to bodyX/bodyY on revive (Story 3.21b, AC4)', () => {
    const downed = mockPlayer({ id: 'ally', isDown: true, hp: 0, x: 999, y: 999, bodyX: 300, bodyY: 200 });
    const revived = reviveBySoulMend(downed, REVIVE_HP);
    expect(revived.x).toBe(300);
    expect(revived.y).toBe(200);
  });

  it('falls back to the current x/y when bodyX/bodyY are absent', () => {
    const downed = mockPlayer({ id: 'ally', isDown: true, hp: 0, x: 300, y: 200 });
    const revived = reviveBySoulMend(downed, REVIVE_HP);
    expect(revived.x).toBe(300);
    expect(revived.y).toBe(200);
  });
});

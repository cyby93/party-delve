import { describe, it, expect } from 'vitest';
import { applyPlayerDamage, getReviveWindowMs } from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'p1',
    displayName: 'TestPlayer',
    class: PlayerClass.STONEHIDE,
    x: 500, y: 300,
    hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
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

describe('applyPlayerDamage', () => {
  it('reduces hp by damage', () => {
    const r = applyPlayerDamage(mockPlayer(), 15, 0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.player.hp).toBe(85);
      expect(r.value.downed).toBe(false);
    }
  });

  it('clamps to 0 and sets downed=true when damage >= hp', () => {
    const r = applyPlayerDamage(mockPlayer({ hp: 10 }), 50, 0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.player.hp).toBe(0);
      expect(r.value.player.isDown).toBe(true);
      expect(r.value.downed).toBe(true);
      expect(r.value.reviveWindowMs).toBeDefined();
    }
  });

  it('increments downCount when downed', () => {
    const r = applyPlayerDamage(mockPlayer({ hp: 5, downCount: 2 }), 100, 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.player.downCount).toBe(3);
  });

  it('returns error if player is already down', () => {
    const r = applyPlayerDamage(mockPlayer({ isDown: true, hp: 0 }), 10, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PLAYER_NOT_DAMAGEABLE');
  });

  it('returns error for negative damage', () => {
    const r = applyPlayerDamage(mockPlayer(), -5, 0);
    expect(r.ok).toBe(false);
  });

  it('does not mutate the original player object', () => {
    const p = mockPlayer();
    applyPlayerDamage(p, 10, 0);
    expect(p.hp).toBe(100);
  });
});

describe('getReviveWindowMs', () => {
  it('returns 60000 for downCount=1', () => expect(getReviveWindowMs(1)).toBe(60000));
  it('returns 40000 for downCount=2', () => expect(getReviveWindowMs(2)).toBe(40000));
  it('returns 20000 for downCount=3', () => expect(getReviveWindowMs(3)).toBe(20000));
  it('returns 10000 for downCount=4', () => expect(getReviveWindowMs(4)).toBe(10000));
  it('returns 5000 for downCount=5',  () => expect(getReviveWindowMs(5)).toBe(5000));
  it('returns 2000 for downCount=6',  () => expect(getReviveWindowMs(6)).toBe(2000));
  it('returns 2000 for downCount=10 (capped)', () => expect(getReviveWindowMs(10)).toBe(2000));
});

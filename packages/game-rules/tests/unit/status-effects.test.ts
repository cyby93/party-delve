import { describe, it, expect } from 'vitest';
import type { PlayerState, StatusEffect } from 'shared-types';
import { applyStatusEffect } from '../../src/systems/status-effects.js';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p0', displayName: 'P0', class: null,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionColor: 'red' as any, downCount: 0,
    nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

function effect(type: StatusEffect['type'], magnitude: number, expiresAtMs = 10_000): StatusEffect {
  return { type, magnitude, expiresAtMs };
}

describe('applyStatusEffect — magnitude validation (AC6)', () => {
  it('rejects a negative shield magnitude', () => {
    const result = applyStatusEffect(makePlayer(), effect('shield', -5), 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'INVALID_MAGNITUDE', detail: '-5' });
  });

  it('accepts a positive shield magnitude above 1, e.g. Warding Cry\'s 30', () => {
    const result = applyStatusEffect(makePlayer(), effect('shield', 30), 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.target.statusEffects[0]?.magnitude).toBe(30);
  });

  it('still rejects a non-shield type below 0 (regression)', () => {
    const result = applyStatusEffect(makePlayer(), effect('damageReduction', -0.1), 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_MAGNITUDE');
  });

  it('still rejects a non-shield type above 1 (regression)', () => {
    const result = applyStatusEffect(makePlayer(), effect('damageReduction', 1.5), 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_MAGNITUDE');
  });
});

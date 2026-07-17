import { describe, it, expect } from 'vitest';
import { resolveOutgoingDamage, BOND_DAMAGE_MULT, DEBUG_GOD_MODE_DAMAGE_MULT } from '../../src/balance.js';

describe('resolveOutgoingDamage', () => {
  it('passes raw damage through unchanged with no buffs', () => {
    expect(resolveOutgoingDamage(100, false, false)).toBe(100);
  });

  it('applies BOND_DAMAGE_MULT when bonded', () => {
    expect(resolveOutgoingDamage(100, true, false)).toBe(Math.round(100 * BOND_DAMAGE_MULT));
  });

  it('applies DEBUG_GOD_MODE_DAMAGE_MULT when in god mode', () => {
    expect(resolveOutgoingDamage(100, false, true)).toBe(Math.round(100 * DEBUG_GOD_MODE_DAMAGE_MULT));
  });

  it('multiplies both buffs together when stacked', () => {
    expect(resolveOutgoingDamage(100, true, true)).toBe(Math.round(100 * BOND_DAMAGE_MULT * DEBUG_GOD_MODE_DAMAGE_MULT));
  });

  it('does not round when the combined multiplier is exactly 1', () => {
    expect(resolveOutgoingDamage(33.7, false, false)).toBe(33.7);
  });
});

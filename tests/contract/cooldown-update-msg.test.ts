import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { CooldownUpdateMsg } from 'net-protocol';

describe('CooldownUpdateMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: CooldownUpdateMsg = { type: 'cooldown:update', abilityIndex: 2, remainingMs: 3000 };
    expect(deserialize<CooldownUpdateMsg>(serialize(msg))).toEqual(msg);
  });

  it('handles zero remainingMs (cooldown cleared)', () => {
    const msg: CooldownUpdateMsg = { type: 'cooldown:update', abilityIndex: 0, remainingMs: 0 };
    expect(deserialize<CooldownUpdateMsg>(serialize(msg))).toEqual(msg);
  });
});

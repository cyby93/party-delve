import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { ReturnToCampMsg } from 'net-protocol';

describe('ReturnToCampMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: ReturnToCampMsg = { type: 'return:to-camp' };
    expect(deserialize<ReturnToCampMsg>(serialize(msg))).toEqual(msg);
  });
});

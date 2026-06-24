import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { ClassSelectMsg } from 'net-protocol';
import { PlayerClass } from 'shared-types';

describe('ClassSelectMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: ClassSelectMsg = { type: 'class:select', classId: PlayerClass.SOULDRINKER };
    expect(deserialize<ClassSelectMsg>(serialize(msg))).toEqual(msg);
  });

  it('round-trips for each PlayerClass value', () => {
    for (const classId of Object.values(PlayerClass)) {
      const msg: ClassSelectMsg = { type: 'class:select', classId };
      expect(deserialize<ClassSelectMsg>(serialize(msg))).toEqual(msg);
    }
  });
});

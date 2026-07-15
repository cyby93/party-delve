import { describe, it, expect } from 'vitest';
import type { ZoneState } from 'shared-types';
import { shouldZoneTick, isZoneExpired } from '../../src/systems/zones.js';

function makeZone(overrides: Partial<ZoneState> = {}): ZoneState {
  return {
    id: 'z0', ownerId: 'p0', x: 0, y: 0, radius: 50,
    effectType: 'damage', tickIntervalMs: 500, expiresAtMs: 10_000,
    ...overrides,
  };
}

describe('shouldZoneTick', () => {
  it('returns true once tickIntervalMs has elapsed', () => {
    expect(shouldZoneTick(makeZone({ tickIntervalMs: 500 }), 1500, 1000)).toBe(true);
  });

  it('returns false before tickIntervalMs has elapsed', () => {
    expect(shouldZoneTick(makeZone({ tickIntervalMs: 500 }), 1400, 1000)).toBe(false);
  });

  it('returns false for tickIntervalMs === 0 regardless of elapsed time', () => {
    expect(shouldZoneTick(makeZone({ tickIntervalMs: 0 }), 999_999, 0)).toBe(false);
  });

  it('returns false for a negative tickIntervalMs regardless of elapsed time', () => {
    expect(shouldZoneTick(makeZone({ tickIntervalMs: -100 }), 999_999, 0)).toBe(false);
  });
});

describe('isZoneExpired', () => {
  it('returns true once nowMs reaches expiresAtMs', () => {
    expect(isZoneExpired(makeZone({ expiresAtMs: 5000 }), 5000)).toBe(true);
  });

  it('returns false before expiresAtMs', () => {
    expect(isZoneExpired(makeZone({ expiresAtMs: 5000 }), 4999)).toBe(false);
  });
});

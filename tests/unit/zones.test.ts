import { describe, it, expect } from 'vitest';
import { shouldZoneTick, isZoneExpired } from 'game-rules';
import type { ZoneState } from 'shared-types';

function mockZone(overrides?: Partial<ZoneState>): ZoneState {
  return {
    id: 'zone-1',
    ownerId: 'p1',
    x: 500,
    y: 300,
    radius: 150,
    effectType: 'damage',
    tickIntervalMs: 1000,
    expiresAtMs: 10_000,
    ...overrides,
  };
}

describe('shouldZoneTick', () => {
  it('returns false before tickIntervalMs has elapsed since lastTickAtMs', () => {
    expect(shouldZoneTick(mockZone(), 1500, 1000)).toBe(false);
  });

  it('returns true once tickIntervalMs has elapsed', () => {
    expect(shouldZoneTick(mockZone(), 2000, 1000)).toBe(true);
  });

  it('returns true on the very first check when lastTickAtMs=0 and nowMs >= tickIntervalMs', () => {
    expect(shouldZoneTick(mockZone(), 1000, 0)).toBe(true);
  });
});

describe('isZoneExpired', () => {
  it('returns false before expiresAtMs', () => {
    expect(isZoneExpired(mockZone(), 5000)).toBe(false);
  });

  it('returns true at expiresAtMs', () => {
    expect(isZoneExpired(mockZone(), 10_000)).toBe(true);
  });

  it('returns true after expiresAtMs', () => {
    expect(isZoneExpired(mockZone(), 15_000)).toBe(true);
  });
});

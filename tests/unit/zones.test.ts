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

describe('pull effectType (Story 3.19: Void Pulse)', () => {
  // shouldZoneTick/isZoneExpired are effectType-agnostic (they only read
  // tickIntervalMs/expiresAtMs) — a 'pull' zone must behave identically to a
  // 'damage' zone for timing purposes. The actual pull displacement math is
  // covered by applyDisplacement's own tests (Story 3.14) and GameRoom.ts's
  // 'pull' branch is a GameRoom-integration concern (D-3.16-A's known gap,
  // same as every other kit-rework story in this batch).
  it('shouldZoneTick treats a pull zone the same as a damage zone', () => {
    const pullZone = mockZone({ effectType: 'pull' });
    expect(shouldZoneTick(pullZone, 1500, 1000)).toBe(false);
    expect(shouldZoneTick(pullZone, 2000, 1000)).toBe(true);
  });

  it('isZoneExpired treats a pull zone the same as a damage zone', () => {
    const pullZone = mockZone({ effectType: 'pull' });
    expect(isZoneExpired(pullZone, 5000)).toBe(false);
    expect(isZoneExpired(pullZone, 10_000)).toBe(true);
  });
});

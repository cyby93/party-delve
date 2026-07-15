import { describe, it, expect } from 'vitest';
import { pickRandomIndex, createRng, shouldZoneTick, isZoneExpired, STORM_EYE_TICK_MS, STORM_EYE_DURATION_MS, STORM_EYE_STRIKE_INTERVAL_MS } from 'game-rules';
import type { ZoneState } from 'shared-types';

describe('pickRandomIndex (Story 3.20: Storm Eye bonus-strike target selection)', () => {
  it('stays within [0, count) bounds', () => {
    expect(pickRandomIndex(0, 3)).toBe(0);
    expect(pickRandomIndex(0.999999, 3)).toBe(2);
  });

  it('produces identical sequences for two independently-seeded xoshiro128++ streams (NFR7: no Math.random())', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = [pickRandomIndex(rng1(), 5), pickRandomIndex(rng1(), 5), pickRandomIndex(rng1(), 5)];
    const seq2 = [pickRandomIndex(rng2(), 5), pickRandomIndex(rng2(), 5), pickRandomIndex(rng2(), 5)];
    expect(seq1).toEqual(seq2);
  });

  it('diverges for different seeds', () => {
    const rngA = createRng(1);
    const rngB = createRng(2);
    const seqA = Array.from({ length: 10 }, () => pickRandomIndex(rngA(), 100));
    const seqB = Array.from({ length: 10 }, () => pickRandomIndex(rngB(), 100));
    expect(seqA).not.toEqual(seqB);
  });
});

describe('Storm Eye zone cadence (Story 3.20)', () => {
  function mockStormEyeZone(overrides?: Partial<ZoneState>): ZoneState {
    return {
      id: 'zone-storm-eye',
      ownerId: 'p1',
      x: 500,
      y: 300,
      radius: 150,
      effectType: 'damage',
      tickIntervalMs: STORM_EYE_TICK_MS,
      expiresAtMs: STORM_EYE_DURATION_MS,
      ...overrides,
    };
  }

  // Regression confirmation, not new logic — Storm Eye's steady damage tick reuses
  // Story 3.13's existing 'damage' zone-tick case verbatim (GameRoom.ts), so the
  // GameRoom-integration behavior is covered by that story's own tests. This confirms
  // the shared timing primitives behave correctly with Storm Eye's specific constants.
  it('steady tick fires once STORM_EYE_TICK_MS has elapsed', () => {
    const zone = mockStormEyeZone();
    expect(shouldZoneTick(zone, STORM_EYE_TICK_MS - 1, 0)).toBe(false);
    expect(shouldZoneTick(zone, STORM_EYE_TICK_MS, 0)).toBe(true);
  });

  it('zone expires at STORM_EYE_DURATION_MS', () => {
    const zone = mockStormEyeZone();
    expect(isZoneExpired(zone, STORM_EYE_DURATION_MS - 1)).toBe(false);
    expect(isZoneExpired(zone, STORM_EYE_DURATION_MS)).toBe(true);
  });

  it('the bonus-strike interval is longer than the steady tick interval (AC2)', () => {
    expect(STORM_EYE_STRIKE_INTERVAL_MS).toBeGreaterThan(STORM_EYE_TICK_MS);
  });
});

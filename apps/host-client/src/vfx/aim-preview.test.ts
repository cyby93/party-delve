import { describe, it, expect } from 'vitest';
import { PlayerClass, ABILITY_GEOMETRY, STORM_EYE_ZONE_RADIUS_PX } from 'shared-types';
import {
  AIM_PREVIEW_STALE_MS,
  isAimPreviewStale,
  pruneStaleAimPreviews,
  resolveAimPreviewShape,
  coneSectorPoints,
  type AimPreviewState,
} from './aim-preview';

const state = (lastSeenAtMs: number): AimPreviewState => ({
  abilityIndex: 0,
  directionX: 1,
  directionY: 0,
  lastSeenAtMs,
});

describe('isAimPreviewStale (Story 7.15c AC5)', () => {
  it('keeps a preview refreshed within the window', () => {
    expect(isAimPreviewStale(1000, 1000 + AIM_PREVIEW_STALE_MS - 1)).toBe(false);
  });

  it('drops a preview exactly at the window boundary', () => {
    expect(isAimPreviewStale(1000, 1000 + AIM_PREVIEW_STALE_MS)).toBe(true);
  });

  it('drops a preview past the window', () => {
    expect(isAimPreviewStale(1000, 1000 + AIM_PREVIEW_STALE_MS + 500)).toBe(true);
  });

  it('treats a non-finite timestamp as stale, not as infinitely fresh', () => {
    // The failure mode this guards: `Infinity - NaN` style arithmetic yielding
    // NaN, which compares false against everything and would pin an arrow on
    // screen forever with no way to clear it.
    expect(isAimPreviewStale(NaN, 1000)).toBe(true);
    expect(isAimPreviewStale(Infinity, 1000)).toBe(true);
  });

  it('survives a backward clock step without pinning the arrow', () => {
    // Date.now() is not monotonic (NTP correction). A backward step makes
    // `now - lastSeen` negative, i.e. "fresh" — the arrow lingers for at most
    // the size of the step rather than clearing early. That is the safe
    // direction to fail, and this pins the behaviour deliberately.
    expect(isAimPreviewStale(2000, 1000)).toBe(false);
  });

  it('the window is sized in whole refresh intervals of the ~33ms send cadence', () => {
    // Not an arbitrary magic number: 150ms is ~4-5 sends. Guards against someone
    // shrinking it to one tick, which would strobe on a single dropped packet.
    expect(AIM_PREVIEW_STALE_MS / 33).toBeGreaterThanOrEqual(3);
    expect(AIM_PREVIEW_STALE_MS).toBeLessThanOrEqual(250);
  });
});

describe('pruneStaleAimPreviews', () => {
  it('removes only the stale entries', () => {
    const now = 10_000;
    const previews = new Map<string, AimPreviewState>([
      ['fresh', state(now - 10)],
      ['stale', state(now - AIM_PREVIEW_STALE_MS - 1)],
      ['edge', state(now - AIM_PREVIEW_STALE_MS)],
    ]);
    pruneStaleAimPreviews(previews, now);
    expect([...previews.keys()]).toEqual(['fresh']);
  });

  it('is a no-op on an empty map', () => {
    const previews = new Map<string, AimPreviewState>();
    pruneStaleAimPreviews(previews, 1000);
    expect(previews.size).toBe(0);
  });
});

describe('resolveAimPreviewShape (AC3)', () => {
  it('Storm Eye previews the real zone radius, not its hit radius', () => {
    const shape = resolveAimPreviewShape(PlayerClass.STORMCALLER, 3);
    expect(shape).toEqual({ kind: 'circle', radius: STORM_EYE_ZONE_RADIUS_PX });
    // Explicitly NOT hitRadiusPx (80) — the ghost must match the zone that gets
    // placed, which is what the player is actually aiming.
    expect(ABILITY_GEOMETRY[PlayerClass.STORMCALLER][3].hitRadiusPx).not.toBe(STORM_EYE_ZONE_RADIUS_PX);
  });

  it('Stone Wall previews a cone at its live contract angle and range', () => {
    const geometry = ABILITY_GEOMETRY[PlayerClass.STONEHIDE][0];
    expect(resolveAimPreviewShape(PlayerClass.STONEHIDE, 0)).toEqual({
      kind: 'cone', angleDeg: geometry.coneAngleDeg, lengthPx: geometry.hitRangePx,
    });
  });

  it('Crimson Lash previews a cone at its live contract angle and range', () => {
    const geometry = ABILITY_GEOMETRY[PlayerClass.SOULDRINKER][1];
    expect(resolveAimPreviewShape(PlayerClass.SOULDRINKER, 1)).toEqual({
      kind: 'cone', angleDeg: geometry.coneAngleDeg, lengthPx: geometry.hitRangePx,
    });
  });

  it("Dark Pact previews its existing hit-shape — a circle of hitRadiusPx", () => {
    const geometry = ABILITY_GEOMETRY[PlayerClass.SOULDRINKER][2];
    expect(resolveAimPreviewShape(PlayerClass.SOULDRINKER, 2)).toEqual({
      kind: 'circle', radius: geometry.hitRadiusPx,
    });
  });

  it('reads geometry live rather than hand-copying it', () => {
    // The values are only correct because they come from ABILITY_GEOMETRY. If a
    // future retune changes Stone Wall's cone, this assertion moves with it —
    // which is the point.
    const shape = resolveAimPreviewShape(PlayerClass.STONEHIDE, 0);
    expect(shape).not.toBeNull();
    if (shape?.kind === 'cone') {
      expect(shape.angleDeg).toBe(ABILITY_GEOMETRY[PlayerClass.STONEHIDE][0].coneAngleDeg);
      expect(shape.lengthPx).toBe(ABILITY_GEOMETRY[PlayerClass.STONEHIDE][0].hitRangePx);
    }
  });

  it('returns null for an out-of-range ability index rather than throwing', () => {
    expect(resolveAimPreviewShape(PlayerClass.STONEHIDE, 99)).toBeNull();
  });
});

describe('coneSectorPoints (AC3 geometry)', () => {
  /** Shoelace area of a closed polygon. */
  const area = (pts: { x: number; y: number }[]): number => {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  };

  // This is the assertion style Story 7.13's manual pass proved is necessary: a
  // bounds-only check passes for both the correct pie slice AND the broken
  // sliver that filled ~12% of the intended area, because bounds reflect vertex
  // extents rather than fill topology. Area does not.
  it('encloses the closed-form sector area across directions and angles', () => {
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.6, 0.8]] as const) {
      for (const angleDeg of [20, 45, 50, 70]) {
        const r = 160;
        const pts = coneSectorPoints(0, 0, dx, dy, angleDeg, r, 64);
        const expected = 0.5 * r * r * ((angleDeg * Math.PI) / 180);
        // Chord approximation of the arc sits just inside the true sector, so a
        // small negative bias is expected; 1.5% covers it at 64 segments.
        expect(area(pts)).toBeGreaterThan(expected * 0.985);
        expect(area(pts)).toBeLessThanOrEqual(expected * 1.001);
      }
    }
  });

  it('is apex-first, so the polygon starts at the caster', () => {
    const pts = coneSectorPoints(500, 400, 1, 0, 50, 160);
    expect(pts[0]).toEqual({ x: 500, y: 400 });
  });

  it('points along the given direction', () => {
    const pts = coneSectorPoints(0, 0, 0, 1, 50, 100);
    // Every arc point should be on the +y side for a straight-down aim.
    for (const p of pts.slice(1)) expect(p.y).toBeGreaterThan(0);
  });

  it('normalizes a non-unit direction', () => {
    const unit = coneSectorPoints(0, 0, 1, 0, 50, 100, 8);
    const scaled = coneSectorPoints(0, 0, 7, 0, 50, 100, 8);
    expect(scaled).toEqual(unit);
  });

  it('returns an empty polygon for a zero or non-finite direction rather than NaN points', () => {
    expect(coneSectorPoints(0, 0, 0, 0, 50, 100)).toEqual([]);
    expect(coneSectorPoints(0, 0, NaN, NaN, 50, 100)).toEqual([]);
  });

  it('returns an empty polygon for a non-positive length', () => {
    expect(coneSectorPoints(0, 0, 1, 0, 50, 0)).toEqual([]);
    expect(coneSectorPoints(0, 0, 1, 0, 50, -10)).toEqual([]);
  });
});

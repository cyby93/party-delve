import { describe, expect, it } from 'vitest';
import { PlayerClass, ABILITY_GEOMETRY } from 'shared-types';
import {
  planSpiritcallerCast,
  factionAccentFor,
  ANCESTORS_VOICE_RANGE_PX,
} from './spiritcaller-vfx';

// Pure planner + classifier only — no canvas. Rendering correctness is the
// Client-UX manual pass (Story 7.3 §9).

const spiritcaller = (x = 500, y = 400) => ({ class: PlayerClass.SPIRITCALLER, x, y });

describe('planSpiritcallerCast', () => {
  it('places Ancestor\'s Voice focus at the live contract range, not a transcribed literal (AC4)', () => {
    // Asserts the planner's placement math against the contract *directly* — a
    // re-hardcoded ANCESTORS_VOICE_RANGE_PX (or a drifted transcription) would
    // move the focus off `caster + aim × ABILITY_GEOMETRY.spiritcaller[0].hitRangePx`
    // and fail this, which `expect(export).toBe(export)` could never catch.
    const plan = planSpiritcallerCast(spiritcaller(500, 400), 0, 1, 0)!;
    expect(plan.focusX).toBeCloseTo(500 + ABILITY_GEOMETRY.spiritcaller[0].hitRangePx, 6);
    expect(plan.focusY).toBeCloseTo(400, 6);
  });

  it('returns null for a non-Spiritcaller caster', () => {
    for (const cls of [PlayerClass.STONEHIDE, PlayerClass.SOULDRINKER, PlayerClass.STORMCALLER]) {
      expect(planSpiritcallerCast({ class: cls, x: 0, y: 0 }, 0, 1, 0), cls).toBeNull();
    }
  });

  it('returns null for Soul Mend (idx 2) — it is channel-driven, not delta-driven', () => {
    expect(planSpiritcallerCast(spiritcaller(), 2, 1, 0)).toBeNull();
  });

  it('returns null for an out-of-range or non-integer ability index', () => {
    for (const idx of [-1, 4, 1.5, NaN]) {
      expect(planSpiritcallerCast(spiritcaller(), idx, 1, 0), `idx ${idx}`).toBeNull();
    }
  });

  it('projects Ancestor\'s Voice (idx 0) focus to exactly ANCESTORS_VOICE_RANGE_PX along the aim', () => {
    const plan = planSpiritcallerCast(spiritcaller(500, 400), 0, 1, 0)!;
    expect(plan.ability).toBe('ancestors-voice');
    expect(plan.focusX).toBeCloseTo(500 + ANCESTORS_VOICE_RANGE_PX, 6);
    expect(plan.focusY).toBeCloseTo(400, 6);
    expect(plan.originX).toBe(500);
    expect(plan.originY).toBe(400);
  });

  it('normalizes an un-normalized aim direction before projecting the focus', () => {
    const unit = planSpiritcallerCast(spiritcaller(500, 400), 0, 0.6, 0.8)!;
    const scaled = planSpiritcallerCast(spiritcaller(500, 400), 0, 3, 4)!; // magnitude 5
    expect(scaled.focusX).toBeCloseTo(unit.focusX, 6);
    expect(scaled.focusY).toBeCloseTo(unit.focusY, 6);
    // and the focus is one range unit away from the origin
    const dist = Math.hypot(scaled.focusX - 500, scaled.focusY - 400);
    expect(dist).toBeCloseTo(ANCESTORS_VOICE_RANGE_PX, 6);
  });

  it('returns null for a zero-aim Ancestor\'s Voice — the sim skips that hit (SILENT rule)', () => {
    expect(planSpiritcallerCast(spiritcaller(), 0, 0, 0)).toBeNull();
  });

  it('still plans the self-centred TAP abilities on zero aim, with focus === origin and no NaN', () => {
    for (const idx of [1, 3]) {
      const plan = planSpiritcallerCast(spiritcaller(500, 400), idx, 0, 0)!;
      expect(plan, `idx ${idx}`).not.toBeNull();
      expect(plan.focusX).toBe(500);
      expect(plan.focusY).toBe(400);
      expect(Number.isNaN(plan.focusX)).toBe(false);
      expect(Number.isNaN(plan.focusY)).toBe(false);
    }
    expect(planSpiritcallerCast(spiritcaller(), 1, 0, 0)!.ability).toBe('spirit-nova');
    expect(planSpiritcallerCast(spiritcaller(), 3, 0, 0)!.ability).toBe('warding-cry');
  });
});

describe('factionAccentFor', () => {
  it('classifies an HP change by sign, null on equal', () => {
    expect(factionAccentFor(50, 80)).toBe('heal');
    expect(factionAccentFor(80, 50)).toBe('damage');
    expect(factionAccentFor(50, 50)).toBeNull();
  });
});

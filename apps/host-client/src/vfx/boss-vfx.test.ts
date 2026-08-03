import { describe, expect, it } from 'vitest';
import { BossPhase } from 'shared-types';
import {
  planBossVfx,
  BOSS_CHARGE_STREAK_PX,
  VFX_PHASE3,
  VFX_CORRUPTION,
} from './boss-vfx';
import type { VfxDescriptor } from './boss-vfx';

// Pure planner only — no canvas. Rendering correctness is the Client-UX manual
// pass (Story 7.7b §Dev Notes → manual checklist).

const PURIFY_TOKEN = 0x90d8f0; // accent-purify — reserved exclusively for the boss-defeat moment (AC6)

describe('planBossVfx — boss:charged', () => {
  it('emits a beam ending exactly at (x, y), with length BOSS_CHARGE_STREAK_PX along the real displacement (AC1)', () => {
    // prevX/prevY 11.7px behind input.x/y — the real per-tick charge displacement
    const ctx = { bossX: 500, bossY: 400, prevX: 500 - 11.7, prevY: 400 };
    const plan = planBossVfx({ type: 'boss:charged', x: 500, y: 400 }, ctx);
    const beam = plan.find((d): d is Extract<VfxDescriptor, { kind: 'beam' }> => d.kind === 'beam');
    expect(beam).toBeDefined();
    expect(beam!.toX).toBe(500);
    expect(beam!.toY).toBe(400);
    const len = Math.hypot(beam!.toX - beam!.x, beam!.toY - beam!.y);
    expect(len).toBeCloseTo(BOSS_CHARGE_STREAK_PX, 3);
    // unit direction matches the prev->new displacement (+x)
    const ux = (beam!.toX - beam!.x) / len;
    const uy = (beam!.toY - beam!.y) / len;
    expect(ux).toBeCloseTo(1, 6);
    expect(uy).toBeCloseTo(0, 6);
  });

  it('emits no beam on degenerate (zero) displacement, still emits the burst, no NaN anywhere', () => {
    const ctx = { bossX: 500, bossY: 400, prevX: 500, prevY: 400 };
    const plan = planBossVfx({ type: 'boss:charged', x: 500, y: 400 }, ctx);
    expect(plan.some(d => d.kind === 'beam')).toBe(false);
    expect(plan.some(d => d.kind === 'burst')).toBe(true);
    for (const d of plan) {
      for (const v of Object.values(d)) {
        if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
        if (Array.isArray(v)) for (const c of v) expect(Number.isNaN(c)).toBe(false);
      }
    }
  });
});

describe('planBossVfx — boss:stomped', () => {
  it('sizes the ring from the delta radius, not a hardcoded 280', () => {
    const ctx = { bossX: 0, bossY: 0, prevX: 0, prevY: 0 };
    const plan = planBossVfx({ type: 'boss:stomped', x: 100, y: 200, radius: 199 }, ctx);
    const ring = plan.find((d): d is Extract<VfxDescriptor, { kind: 'ring' }> => d.kind === 'ring');
    expect(ring).toBeDefined();
    expect(ring!.maxRadius).toBe(199);
  });
});

describe('planBossVfx — boss:phaseChanged', () => {
  it('colors Phase3 as VFX_PHASE3 (0xff2222) and Phase2 as VFX_CORRUPTION (0x7d2dff)', () => {
    const ctx = { bossX: 0, bossY: 0, prevX: 0, prevY: 0 };
    const phase3Plan = planBossVfx({ type: 'boss:phaseChanged', newPhase: BossPhase.Phase3 }, ctx);
    const phase2Plan = planBossVfx({ type: 'boss:phaseChanged', newPhase: BossPhase.Phase2 }, ctx);
    expect(phase3Plan.every(d => 'color' in d ? d.color === VFX_PHASE3 : true)).toBe(true);
    expect(phase2Plan.every(d => 'color' in d ? d.color === VFX_CORRUPTION : true)).toBe(true);
    expect(phase3Plan.some(d => d.kind === 'tint' && d.color === VFX_PHASE3)).toBe(true);
    expect(phase2Plan.some(d => d.kind === 'tint' && d.color === VFX_CORRUPTION)).toBe(true);
  });
});

describe('planBossVfx — reserved token (AC6)', () => {
  it('never emits accent-purify (0x90d8f0) in any descriptor, across every input case', () => {
    const ctx = { bossX: 500, bossY: 400, prevX: 500, prevY: 400 };
    const chargeCtx = { bossX: 500, bossY: 400, prevX: 480, prevY: 400 };
    const plans: VfxDescriptor[][] = [
      planBossVfx({ type: 'boss:charged', x: 500, y: 400 }, chargeCtx),
      planBossVfx({ type: 'boss:stomped', x: 500, y: 400, radius: 280 }, ctx),
      planBossVfx({ type: 'boss:phaseChanged', newPhase: BossPhase.Phase2 }, ctx),
      planBossVfx({ type: 'boss:phaseChanged', newPhase: BossPhase.Phase3 }, ctx),
      planBossVfx({ type: 'boss:damaged' }, ctx),
    ];
    for (const plan of plans) {
      for (const d of plan) {
        const colors = Array.isArray(d.color) ? d.color : [d.color];
        expect(colors).not.toContain(PURIFY_TOKEN);
      }
    }
  });
});

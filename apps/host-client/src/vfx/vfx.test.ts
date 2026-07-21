import { describe, expect, it, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { VfxEngine } from './engine';
import { progress, type EffectHandle, type VfxStage } from './types';
import {
  createBeam,
  createParticleBurst,
  createRingShockwave,
  createTintPulse,
  createTrail,
} from './primitives';

// `pixi.js` imports fine under a plain Node vitest run — only actual GPU
// rendering needs a canvas, and nothing here renders. Every test drives a fake
// clock explicitly, so no primitive ever reads a real timer.

function fakeStage(): VfxStage & { children: unknown[] } {
  const children: unknown[] = [];
  return {
    children,
    addChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
  };
}

describe('progress', () => {
  it('clamps to 0..1 and reports complete for degenerate inputs', () => {
    expect(progress(50, 0, 100)).toBe(0.5);
    expect(progress(999, 0, 100)).toBe(1);
    expect(progress(-10, 0, 100)).toBe(0);
    expect(progress(0, 0, 0)).toBe(1); // zero duration
    expect(progress(0, 0, -5)).toBe(1); // negative duration
    expect(progress(NaN, 0, 100)).toBe(1); // non-finite clock
    expect(progress(0, NaN, 100)).toBe(1); // non-finite start
  });
});

describe('primitive lifecycle contract', () => {
  // The contract every primitive shares: alive until durationMs has elapsed,
  // complete exactly at it, and its start is taken from the first update() so
  // the caller's clock is always the effect's clock.
  const factories: Array<[string, (durationMs: number) => EffectHandle]> = [
    ['particleBurst', d => createParticleBurst({ x: 0, y: 0, color: 0xff0000, durationMs: d })],
    ['trail', d => createTrail({ x: 0, y: 0, color: 0xff0000, durationMs: d })],
    ['ringShockwave', d => createRingShockwave({ x: 0, y: 0, color: 0xff0000, durationMs: d, maxRadius: 50 })],
    ['beam', d => createBeam({ x: 0, y: 0, toX: 10, toY: 10, color: 0xff0000, durationMs: d })],
    ['tintPulse', d => createTintPulse({ target: new Container(), durationMs: d })],
  ];

  for (const [name, make] of factories) {
    it(`${name} runs from its first update() to completion, on any clock`, () => {
      const handle = make(100);
      // A Date.now()-scale clock: nothing may assume performance.now().
      const t0 = 1_700_000_000_000;
      expect(handle.update(t0)).toBe(true);
      expect(handle.update(t0 + 50)).toBe(true);
      expect(handle.update(t0 + 99)).toBe(true);
      expect(handle.update(t0 + 100)).toBe(false);
      handle.dispose();
    });

    it(`${name} completes immediately on a zero duration instead of emitting NaN`, () => {
      const handle = make(0);
      expect(handle.update(0)).toBe(false);
      expect(() => handle.dispose()).not.toThrow();
    });
  }
});

describe('particle burst', () => {
  it('allocates its particles once and only moves them afterwards', () => {
    const burst = createParticleBurst({ x: 5, y: 5, color: [0x111111, 0x222222], durationMs: 100, count: 4 });
    const view = burst.view as Container;
    expect(view.children).toHaveLength(4);

    burst.update(0);
    const first = view.children[0] as Graphics;
    burst.update(50);
    // Same object, moved — not a new Graphics per frame.
    expect(view.children[0]).toBe(first);
    expect(view.children).toHaveLength(4);
    expect(view.alpha).toBeCloseTo(0.5);
    burst.dispose();
  });

  it('never advances particles past their end position, even on a stalled ticker', () => {
    // Same instance throughout — each burst randomizes its own particle speeds.
    const burst = createParticleBurst({ x: 0, y: 0, color: 0xffffff, durationMs: 100, count: 1, speed: 1, spread: 0 });
    const particle = (burst.view as Container).children[0] as Graphics;

    burst.update(0);
    burst.update(100);
    const endX = particle.position.x;
    const endY = particle.position.y;
    expect(Math.abs(endX)).toBeGreaterThan(0); // it did travel

    burst.update(60_000); // tab was backgrounded for a minute
    expect(particle.position.x).toBeCloseTo(endX);
    expect(particle.position.y).toBeCloseTo(endY);

    burst.update(-5_000); // and a backwards clock must not invert it either
    expect(particle.position.x).toBeCloseTo(0);
    burst.dispose();
  });
});

describe('trail', () => {
  it('expires point-by-point and completes once the last point ages out', () => {
    const trail = createTrail({ x: 0, y: 0, color: 0xffffff, durationMs: 100, pointCount: 4 });
    trail.update(0);
    trail.moveTo(10, 0, 20);
    trail.moveTo(20, 0, 40);
    expect(trail.update(50)).toBe(true);
    expect(trail.update(120)).toBe(true); // the 40ms point is still young
    expect(trail.update(141)).toBe(false); // all points older than 100ms
    trail.dispose();
  });

  it('clamps pointCount to a drawable minimum instead of crashing', () => {
    const trail = createTrail({ x: 0, y: 0, color: 0xffffff, durationMs: 100, pointCount: 0 });
    expect(() => trail.moveTo(1, 1, 0)).not.toThrow();
    expect(trail.update(0)).toBe(true);
    trail.dispose();
  });

  it('reports disposal and ignores moveTo afterwards', () => {
    const trail = createTrail({ x: 0, y: 0, color: 0xffffff, durationMs: 100 });
    expect(trail.disposed).toBe(false);
    trail.dispose();
    expect(trail.disposed).toBe(true);
    expect(() => trail.moveTo(1, 1, 0)).not.toThrow();
  });
});

describe('ring shockwave', () => {
  it('never reaches a negative radius when imploding', () => {
    const ring = createRingShockwave({
      x: 0, y: 0, color: 0xffffff, durationMs: 100, startRadius: 40, maxRadius: -100,
    });
    expect(() => {
      ring.update(0);
      ring.update(50);
      ring.update(100);
    }).not.toThrow();
    ring.dispose();
  });
});

describe('beam', () => {
  it('honours its alpha before the first update and draws in local space', () => {
    const beam = createBeam({
      x: 100, y: 50, toX: 140, toY: 50, color: 0xffffff, durationMs: 100, alpha: 0.25,
    });
    const view = beam.view as Graphics;
    expect(view.alpha).toBe(0.25); // not full opacity on the frame it is added
    expect(view.position.x).toBe(100);
    expect(view.position.y).toBe(50);
    beam.update(0);
    beam.update(50);
    expect(view.alpha).toBeCloseTo(0.125);
    beam.dispose();
  });
});

describe('tint pulse', () => {
  it('restores the borrowed target to its pre-trigger alpha, not to maxAlpha', () => {
    const frozenPlayer = new Container();
    frozenPlayer.alpha = 0.3; // e.g. a frozen player in DungeonScreen.tsx
    const pulse = createTintPulse({ target: frozenPlayer, durationMs: 100 });
    pulse.update(0);
    pulse.update(50);
    expect(frozenPlayer.alpha).toBeCloseTo(0.2); // trough of the pulse
    pulse.update(100);
    pulse.dispose();
    expect(frozenPlayer.alpha).toBe(0.3);
  });

  it('applies and restores tint when a color is given', () => {
    const sprite = new Graphics();
    sprite.tint = 0x00ff00;
    const pulse = createTintPulse({ target: sprite, durationMs: 100, color: 0xff0000 });
    expect(sprite.tint).toBe(0xff0000);
    pulse.update(0);
    pulse.dispose();
    expect(sprite.tint).toBe(0x00ff00);
    sprite.destroy();
  });

  it('is never added to the stage, but is still reaped by the engine', () => {
    const stage = fakeStage();
    const engine = new VfxEngine(stage);
    const target = new Container();
    engine.add(createTintPulse({ target, durationMs: 100, startedAt: 0 }));
    expect(stage.children).toHaveLength(0);
    engine.update(100);
    expect(engine.size).toBe(0);
  });
});

describe('VfxEngine', () => {
  it('adds, advances, and reaps an effect, returning to its pre-trigger size', () => {
    const stage = fakeStage();
    const engine = new VfxEngine(stage);
    const before = engine.size;

    engine.add(createRingShockwave({ x: 0, y: 0, color: 0xffffff, durationMs: 300, maxRadius: 100, startedAt: 1000 }));
    expect(engine.size).toBe(before + 1);
    expect(stage.children).toHaveLength(1);

    for (const now of [1100, 1200, 1299]) {
      engine.update(now);
      expect(engine.size).toBe(before + 1);
    }

    engine.update(1300);
    expect(engine.size).toBe(before);
    expect(stage.children).toHaveLength(0);
  });

  it('reaps concurrent effects independently and supports early removal + clear', () => {
    const stage = fakeStage();
    const engine = new VfxEngine(stage);

    engine.add(createBeam({ x: 0, y: 0, toX: 1, toY: 1, color: 0xffffff, durationMs: 100, startedAt: 0 }));
    engine.add(createBeam({ x: 0, y: 0, toX: 1, toY: 1, color: 0xffffff, durationMs: 500, startedAt: 0 }));
    const cancelledId = engine.add(
      createBeam({ x: 0, y: 0, toX: 1, toY: 1, color: 0xffffff, durationMs: 500, startedAt: 0 }),
    );
    expect(engine.size).toBe(3);

    engine.update(100);
    expect(engine.size).toBe(2);

    engine.remove(cancelledId);
    expect(engine.size).toBe(1);
    engine.remove(cancelledId); // idempotent
    expect(engine.size).toBe(1);

    engine.clear();
    expect(engine.size).toBe(0);
    expect(stage.children).toHaveLength(0);
  });

  it('reaps a throwing effect instead of freezing every effect behind it', () => {
    const stage = fakeStage();
    const engine = new VfxEngine(stage);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const exploding: EffectHandle = {
      view: null,
      update() {
        throw new Error('boom');
      },
      dispose() {},
    };
    engine.add(exploding);
    engine.add(createRingShockwave({ x: 0, y: 0, color: 0xffffff, durationMs: 300, maxRadius: 100, startedAt: 0 }));

    expect(() => engine.update(50)).not.toThrow();
    expect(engine.size).toBe(1); // thrower reaped, survivor still advancing
    engine.update(300);
    expect(engine.size).toBe(0); // survivor completed on schedule
    errorSpy.mockRestore();
  });
});

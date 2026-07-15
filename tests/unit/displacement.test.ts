import { describe, it, expect } from 'vitest';
import { applyDisplacement } from 'game-rules';

describe('applyDisplacement', () => {
  it('pulls toward a source directly to the right of the target', () => {
    const { dx, dy } = applyDisplacement(0, 0, 100, 0, 10);
    expect(dx).toBeCloseTo(10);
    expect(dy).toBeCloseTo(0);
  });

  it('pulls toward a source directly above the target', () => {
    const { dx, dy } = applyDisplacement(0, 0, 0, -100, 10);
    expect(dx).toBeCloseTo(0);
    expect(dy).toBeCloseTo(-10);
  });

  it('pulls toward a diagonal source, normalized and scaled by strength', () => {
    const { dx, dy } = applyDisplacement(0, 0, 300, 400, 5);
    expect(dx).toBeCloseTo(3);
    expect(dy).toBeCloseTo(4);
  });

  it('returns a zero vector (not NaN) when target equals source', () => {
    const { dx, dy } = applyDisplacement(50, 50, 50, 50, 10);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });
});

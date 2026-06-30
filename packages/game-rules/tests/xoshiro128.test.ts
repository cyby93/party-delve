import { describe, it, expect } from 'vitest';
import { createRng } from '../src/prng/xoshiro128.js';

describe('xoshiro128++ PRNG', () => {
  it('produces identical sequences for the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = Array.from({ length: 1000 }, () => rng1());
    const seq2 = Array.from({ length: 1000 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const seq1 = Array.from({ length: 10 }, createRng(1));
    const seq2 = Array.from({ length: 10 }, createRng(2));
    expect(seq1).not.toEqual(seq2);
  });

  it('all values are in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seed 0 does not produce all-zero sequence', () => {
    const rng = createRng(0);
    const values = Array.from({ length: 10 }, () => rng());
    expect(values.some(v => v > 0)).toBe(true);
  });
});

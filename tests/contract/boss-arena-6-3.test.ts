import { describe, it, expect } from 'vitest';
import type { BossMovedDelta } from 'net-protocol';
import { BOSS_ARENA_SPAWN_POINTS, loadBossArena } from '../../apps/simulation-server/src/levels/boss-arena.js';

describe('BossMovedDelta round-trip (AC5)', () => {
  it('preserves type, bossId, x, y through JSON round-trip', () => {
    const delta: BossMovedDelta = { type: 'boss:moved', bossId: 'boss-grassland-42', x: 960, y: 540 };
    const parsed = JSON.parse(JSON.stringify(delta)) as BossMovedDelta;
    expect(parsed.type).toBe('boss:moved');
    expect(parsed.bossId).toBe('boss-grassland-42');
    expect(parsed.x).toBe(960);
    expect(parsed.y).toBe(540);
  });
});

describe('boss-arena.ts smoke check (AC1)', () => {
  it('BOSS_ARENA_SPAWN_POINTS has exactly 4 entries', () => {
    expect(BOSS_ARENA_SPAWN_POINTS.length).toBe(4);
  });

  it('loadBossArena is a function', () => {
    expect(typeof loadBossArena).toBe('function');
  });
});

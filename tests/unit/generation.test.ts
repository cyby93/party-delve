import { describe, it, expect } from 'vitest';
import { createRng, generateFloorLayout, GRASSLAND_ROOM_POOL } from 'game-rules';
import { OFFSET_FLOOR_LAYOUT, OFFSET_ROOM_POOL } from 'shared-types';

const SEED = 0xdeadbeef;

describe('floor layout generation', () => {
  it('AC6: same seed produces identical FloorLayout (determinism)', () => {
    const layout1 = generateFloorLayout(
      createRng(SEED ^ OFFSET_FLOOR_LAYOUT),
      createRng(SEED ^ OFFSET_ROOM_POOL),
      'early',
      GRASSLAND_ROOM_POOL,
    );
    const layout2 = generateFloorLayout(
      createRng(SEED ^ OFFSET_FLOOR_LAYOUT),
      createRng(SEED ^ OFFSET_ROOM_POOL),
      'early',
      GRASSLAND_ROOM_POOL,
    );
    expect(layout1).toEqual(layout2);
  });

  it('AC3: GRASSLAND_ROOM_POOL has at least 3 templates with distinct ids', () => {
    expect(GRASSLAND_ROOM_POOL.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(GRASSLAND_ROOM_POOL.map(t => t.id));
    expect(ids.size).toBe(GRASSLAND_ROOM_POOL.length);
  });

  it('AC3: each template has required fields', () => {
    for (const t of GRASSLAND_ROOM_POOL) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.widthPx).toBe('number');
      expect(typeof t.heightPx).toBe('number');
    }
  });

  it('layout has rooms and corridors arrays', () => {
    const layout = generateFloorLayout(
      createRng(SEED ^ OFFSET_FLOOR_LAYOUT),
      createRng(SEED ^ OFFSET_ROOM_POOL),
      'early',
      GRASSLAND_ROOM_POOL,
    );
    expect(Array.isArray(layout.rooms)).toBe(true);
    expect(Array.isArray(layout.corridors)).toBe(true);
    expect(layout.rooms.length).toBe(4); // early tier
    expect(layout.corridors.length).toBe(3);
  });

  it('last room has isExit=true', () => {
    const layout = generateFloorLayout(
      createRng(SEED ^ OFFSET_FLOOR_LAYOUT),
      createRng(SEED ^ OFFSET_ROOM_POOL),
      'early',
      GRASSLAND_ROOM_POOL,
    );
    expect(layout.rooms.at(-1)!.isExit).toBe(true);
    expect(layout.rooms.slice(0, -1).every(r => !r.isExit)).toBe(true);
  });
});

import type { RoomTemplate, FloorLayout } from 'shared-types';

export const GRASSLAND_ROOM_POOL: readonly RoomTemplate[] = [
  { id: 'grassland-01', name: 'The Clearing',    widthPx: 400, heightPx: 300 },
  { id: 'grassland-02', name: 'The Narrow Path', widthPx: 600, heightPx: 200 },
  { id: 'grassland-03', name: 'The Hollow',      widthPx: 350, heightPx: 350 },
];

// ponytail: static boss floor placeholder — Story 4.3 wires this when levelIndex === 4
export const BOSS_FLOOR_LAYOUT: FloorLayout = {
  rooms: [{ id: 'boss-room', templateId: 'boss-placeholder', x: 960, y: 540, isExit: false }],
  corridors: [],
};

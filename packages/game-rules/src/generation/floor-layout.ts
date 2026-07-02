import type { RoomTemplate, FloorLayout, Room, Corridor } from 'shared-types';

export type LevelTier = 'early' | 'mid' | 'late';

const ROOM_COUNTS: Record<LevelTier, number> = { early: 4, mid: 6, late: 8 };

const GAP_PX   = 80;
const CENTER_Y  = 540;
const JITTER_PX = 200;

export function generateFloorLayout(
  floorRng: () => number,
  roomRng: () => number,
  levelTier: LevelTier,
  roomPool: readonly RoomTemplate[],
): FloorLayout {
  if (roomPool.length === 0) throw new Error('generateFloorLayout: roomPool must not be empty');
  const count = ROOM_COUNTS[levelTier];
  const rooms: Room[] = [];
  const corridors: Corridor[] = [];

  let x = GAP_PX;
  for (let i = 0; i < count; i++) {
    const template = roomPool[Math.floor(roomRng() * roomPool.length)]!;
    const y = CENTER_Y + (floorRng() - 0.5) * JITTER_PX;
    const room: Room = {
      id: `room-${i}`,
      templateId: template.id,
      x: Math.round(x + template.widthPx / 2),
      y: Math.round(y),
      isExit: i === count - 1,
    };
    rooms.push(room);
    x += template.widthPx + GAP_PX;
  }

  for (let i = 0; i < rooms.length - 1; i++) {
    corridors.push({ fromRoomId: rooms[i]!.id, toRoomId: rooms[i + 1]!.id });
  }

  return { rooms, corridors };
}

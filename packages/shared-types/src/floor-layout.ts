export interface RoomTemplate {
  id: string;
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface Room {
  id: string;
  templateId: string;
  x: number;
  y: number;
  isExit: boolean;
}

export interface Corridor {
  fromRoomId: string;
  toRoomId: string;
}

export interface FloorLayout {
  rooms: Room[];
  corridors: Corridor[];
}

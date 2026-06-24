export enum PoiType {
  CLASS_SELECT     = 'class-select',
  TRAINING_DUMMY   = 'training-dummy',
  DUNGEON_ENTRANCE = 'dungeon-entrance',
}

export interface PoiDefinition {
  id: string;
  x: number;      // virtual 1920×1080 coordinate space
  y: number;
  radius: number; // interaction radius in virtual pixels
  type: PoiType;
}

// Static hub world POI layout — positions are in the virtual 1920×1080 space.
// Players spawn near (960, 540) center. Dungeon entrance is top-center.
export const HUB_POIS: ReadonlyArray<PoiDefinition> = [
  { id: 'class-select',     x: 400,  y: 540, radius: 120, type: PoiType.CLASS_SELECT },
  { id: 'training-dummy',   x: 1520, y: 400, radius: 120, type: PoiType.TRAINING_DUMMY },
  { id: 'dungeon-entrance', x: 960,  y: 180, radius: 120, type: PoiType.DUNGEON_ENTRANCE },
];

// Subset of HUB_POIS that send proximity events. Dungeon entrance is excluded until Epic 4.
export const INTERACTIVE_HUB_POIS: ReadonlyArray<PoiDefinition> = HUB_POIS.filter(
  p => p.type !== PoiType.DUNGEON_ENTRANCE,
);

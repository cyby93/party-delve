export type ZoneEffectType = 'damage' | 'pull';

export interface ZoneState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  effectType: ZoneEffectType;
  tickIntervalMs: number;
  expiresAtMs: number;
}

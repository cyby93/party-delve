export enum BossPhase {
  Phase1 = 1,
  Phase2 = 2,
  Phase3 = 3,
}

export interface BossState {
  id: string;
  entityType: 'grassland-boss';
  hp: number;
  maxHp: number;
  phase: BossPhase;
  position: { x: number; y: number };
  isDefeated: boolean;
}

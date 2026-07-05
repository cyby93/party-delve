export enum EnemyFSMState {
  IDLE = 'idle',
  CHASE = 'chase',
  ATTACK = 'attack',
}

export enum EnemyType {
  GRUNT = 'grunt',
  RANGED = 'ranged',
  BRUTE = 'brute',
  ELITE = 'elite',
  GRASSLAND_ADD = 'grassland-add',
}

export enum DifficultyTier {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

export interface EnemyState {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  difficultyTier: DifficultyTier;
  isAlive: boolean;
  fsmState: EnemyFSMState;
  attackCooldownTicks: number;
}

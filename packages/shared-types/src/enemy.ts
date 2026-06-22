export enum EnemyType {
  GRUNT = 'grunt',
  RANGED = 'ranged',
  BRUTE = 'brute',
  ELITE = 'elite',
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
}

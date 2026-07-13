export type StatusEffectType = 'damageReduction' | 'slow' | 'damageBuff' | 'shield';

export interface StatusEffect {
  type: StatusEffectType;
  magnitude: number; // 0-1 fraction for damageReduction/slow/damageBuff; flat HP for shield
  expiresAtMs: number; // host-epoch ms
}

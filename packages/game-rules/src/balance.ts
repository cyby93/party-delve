// ── Enemy AI ──────────────────────────────────────────────────────────────────
export const ENEMY_CHASE_RANGE = 300;         // pixels — triggers IDLE→CHASE
export const ENEMY_ATTACK_RANGE = 60;         // pixels — triggers CHASE→ATTACK
export const ENEMY_CHASE_SPEED = 80;          // pixels per second
export const ENEMY_ATTACK_COOLDOWN_TICKS = 90; // 3 seconds at 30hz — ATTACK duration

// ── Behavior Layers ───────────────────────────────────────────────────────────
export const CHARGE_ACTIVATION_MIN = 100;     // pixels — minimum distance for charge
export const CHARGE_ACTIVATION_MAX = 300;     // pixels — maximum distance for charge
export const CHARGE_SPEED = 400;              // pixels per second (fast dash)
export const CHARGE_COOLDOWN_TICKS = 180;     // 6 seconds at 30hz

export const STOMP_ACTIVATION_RANGE = 80;     // pixels — player must be this close
export const STOMP_RADIUS = 150;              // pixels — AoE radius of stomp effect
export const STOMP_COOLDOWN_TICKS = 240;      // 8 seconds at 30hz

// ── Enemy Count Scaling ───────────────────────────────────────────────────────
// Enemy count scales with player count only — difficulty tier does NOT affect count (FR22)
const ENEMY_RATIO: Record<'early' | 'mid' | 'late', number> = {
  early: 1.5,
  mid:   2.0,
  late:  2.5,
};

export function getEnemyCount(
  playerCount: number,
  levelTier: 'early' | 'mid' | 'late',
): number {
  return Math.ceil(playerCount * ENEMY_RATIO[levelTier]);
}

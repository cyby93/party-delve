export const TICK_RATE_HZ = 30 as const;
export const MAX_PLAYERS = 8 as const;
export const SNAPSHOT_INTERVAL_S = 5 as const;
export const RECONNECT_GRACE_S = 30 as const;

// PRNG stream offsets — each generation system gets an independent RNG stream
// Usage: createRng(runSeed ^ OFFSET_FLOOR_LAYOUT)
export const OFFSET_FLOOR_LAYOUT = 0x01 as const;
export const OFFSET_ROOM_POOL    = 0x02 as const;
export const OFFSET_ENEMY_SPAWN  = 0x03 as const;
export const OFFSET_SPIRIT_BOND  = 0x04 as const;

export const BOSS_PHASE2_HP_RATIO = 0.6 as const;
export const BOSS_PHASE3_HP_RATIO = 0.3 as const;
export const PURIFICATION_PULSE_DURATION_MS = 2500 as const;
export const REWARD_REVEAL_DURATION_MS = 3000 as const;
export const BOSS_REWARD_ESSENCE_BASE = 200 as const;

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

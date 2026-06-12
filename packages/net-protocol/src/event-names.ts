/**
 * EVENT_NAMES — canonical string constants for every wire event name.
 *
 * These match the event categories defined in docs/specs/networking-spec.md
 * § Event Categories. String values are the literal strings that appear in the
 * `t` field of a MessageEnvelope on the wire.
 *
 * Use these constants instead of raw string literals throughout the codebase
 * so that renaming a canonical event name produces a compile-time error.
 */
export const EVENT_NAMES = {
  // Session events
  JOIN: 'join',
  LEAVE: 'leave',
  RECONNECT: 'reconnect',
  READY: 'ready',
  SESSION_START: 'session-start',
  SESSION_END: 'session-end',

  // Input events
  MOVE: 'move',
  AIM: 'aim',
  CAST_START: 'cast-start',
  CAST_RELEASE: 'cast-release',
  INTERACT: 'interact',
  PAUSE_REQUEST: 'pause-request',

  // Simulation events
  SPAWNED: 'spawned',
  DAMAGED: 'damaged',
  HEALED: 'healed',
  DIED: 'died',
  REVIVED: 'revived',
  LOOT_DROPPED: 'loot-dropped',
  COOLDOWN_STARTED: 'cooldown-started',
  COOLDOWN_ENDED: 'cooldown-ended',

  // UI events
  MENU_OPENED: 'menu-opened',
  SELECTION_LOCKED: 'selection-locked',
  COUNTDOWN_STARTED: 'countdown-started',
  RECONNECT_STATE_CHANGED: 'reconnect-state-changed',

  // Meta events
  RUN_COMPLETE: 'run-complete',
  STATS_UPLOAD: 'stats-upload',
  UNLOCK_GRANTED: 'unlock-granted',

  // Type-name wire constants (t field must match the TypeScript type name — see networking-spec.md § Message envelope)
  MOVE_INPUT_EVENT: 'MoveInputEvent',
  SKILL_INPUT_EVENT: 'SkillInputEvent',
  PLAYER_STATE_SNAPSHOT: 'PlayerStateSnapshot',
  SESSION_STATE_EVENT: 'SessionStateEvent',
} as const;

/** Union of all canonical event name string values. */
export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export type GameError =
  | { code: 'INVALID_FSM_STATE'; message: string }
  | { code: 'INVALID_ENEMY_STATE'; message: string };

export type Result<T, E = GameError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

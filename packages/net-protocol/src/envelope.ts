/**
 * MessageEnvelope — the top-level shape of every WebSocket frame in both directions.
 *
 * Wire format (JSON text frame):
 *   { "v": 1, "t": "MoveInputEvent", "p": { ... } }
 *
 * See docs/specs/networking-spec.md § Message envelope for the normative definition.
 */
export interface MessageEnvelope<T = unknown> {
  /** Protocol version. Starts at 1. Increment only on breaking envelope-structure changes. */
  v: number;
  /** Event type name. Matches the TypeScript type name exported from shared-types. */
  t: string;
  /** Payload. Shape is defined by the event type named in `t`. */
  p: T;
}

/**
 * Type guard for MessageEnvelope.
 *
 * Returns true when `value` is a non-null object that has numeric `v`,
 * string `t`, and non-null object `p` — the minimum required envelope
 * fields. Payload shape is not validated here; callers narrow `p` using
 * the specific payload interfaces.
 */
export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).v === 'number' &&
    typeof (value as Record<string, unknown>).t === 'string' &&
    typeof (value as Record<string, unknown>).p === 'object' &&
    (value as Record<string, unknown>).p !== null
  );
}

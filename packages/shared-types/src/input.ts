export interface JoystickInput {
  x: number;
  y: number;
}

export interface AbilityInput {
  abilityIndex: number;
  directionX: number;
  directionY: number;
}

/**
 * An in-progress aim, sent while a `RELEASE`-type ability is mid-drag and before
 * it actually fires (ADR-0008, Story 7.15a). Presentation-only: the sim uses it
 * to broadcast an `ability:aim-preview` delta and nothing else — it never casts,
 * never sets a cooldown, and never mutates `GameState`.
 *
 * Note the shape asymmetry with `'ability'`, which nests its payload under an
 * `ability` key. ADR-0008's Decision section specifies these fields inline on the
 * variant, and the mobile sender (Story 7.15d) and sim reader (Story 7.15b) are
 * both written against that. Do not "tidy" this into a nested payload without
 * updating all three together.
 *
 * DIRECTION INVARIANT — read this before consuming `directionX`/`directionY`:
 * they are NOT guaranteed to be normalized, and NOT guaranteed to be finite.
 * - Not normalized: the sibling `ability` input isn't either. `dispatchAbility`
 *   passes the caster's raw vector through (`game-rules/src/systems/abilities.ts`
 *   only zeroes it for `TAP`); normalization happens later, per delivery branch,
 *   inside `GameRoom`. Any consumer computing a position from this must normalize
 *   first, or it will disagree with where the ability actually lands.
 * - Not finite: serialization is JSON (`net-protocol/src/serialize.ts`), and
 *   `JSON.stringify({ x: NaN })` produces `{"x":null}`. A client that normalizes
 *   a zero-length drag (`0/0`) therefore puts `null` on the wire in a field typed
 *   `number`, and `deserialize` is an unchecked cast that will not catch it.
 *   Guard with the NaN-safe idiom the fire path already uses —
 *   `!(Math.hypot(dx, dy) > 0)` — not with `=== 0`, which `NaN` and `null` pass.
 */
export interface AimPreviewInput {
  abilityIndex: number;
  directionX: number;
  directionY: number;
}

export type InputEvent =
  | { type: 'joystick'; joystick: JoystickInput }
  | { type: 'ability'; ability: AbilityInput }
  | ({ type: 'aim-preview' } & AimPreviewInput);

export interface JoystickInput {
  x: number;
  y: number;
}

export interface AbilityInput {
  abilityIndex: number;
  directionX: number;
  directionY: number;
}

export type InputEvent =
  | { type: 'joystick'; joystick: JoystickInput }
  | { type: 'ability'; ability: AbilityInput };

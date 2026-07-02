import { describe, it, expect } from 'vitest';
import { World, Vec2, Circle } from 'planck';

// Mirrors the Planck phase 1 tick logic from GameRoom.ts:
// if (player.isFrozen || player.class === null) body.setLinearVelocity(Vec2(0, 0))
function tickVelocity(
  body: ReturnType<InstanceType<typeof World>['createBody']>,
  player: { isFrozen: boolean; class: string | null },
  joystick: { x: number; y: number },
) {
  if (player.isFrozen || player.class === null) {
    body.setLinearVelocity(Vec2(0, 0));
    return;
  }
  const inDeadzone = Math.abs(joystick.x) < 0.05 && Math.abs(joystick.y) < 0.05;
  body.setLinearVelocity(inDeadzone ? Vec2(0, 0) : Vec2(joystick.x * 3, joystick.y * 3));
}

describe('null-class velocity gate', () => {
  it('null-class player body stays at spawn after joystick input + several ticks', () => {
    const world = new World({ gravity: Vec2(0, 0) });
    const body = world.createBody({ type: 'dynamic', position: Vec2(10, 5) });
    body.createFixture(new Circle(0.5));

    const player = { isFrozen: false, class: null as string | null };
    const joystick = { x: 1, y: 0 }; // full-right joystick input

    for (let i = 0; i < 10; i++) {
      tickVelocity(body, player, joystick);
      world.step(1 / 30);
    }

    expect(body.getPosition().x).toBeCloseTo(10, 5);
    expect(body.getPosition().y).toBeCloseTo(5, 5);
    expect(body.getLinearVelocity().x).toBe(0);
    expect(body.getLinearVelocity().y).toBe(0);
  });

  it('player with a class does move on joystick input', () => {
    const world = new World({ gravity: Vec2(0, 0) });
    const body = world.createBody({ type: 'dynamic', position: Vec2(10, 5) });
    body.createFixture(new Circle(0.5));

    const player = { isFrozen: false, class: 'stormcaller' };
    const joystick = { x: 1, y: 0 };

    for (let i = 0; i < 10; i++) {
      tickVelocity(body, player, joystick);
      world.step(1 / 30);
    }

    expect(body.getPosition().x).toBeGreaterThan(10);
  });
});

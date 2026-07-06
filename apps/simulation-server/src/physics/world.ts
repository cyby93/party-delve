import { World, Vec2, Body, Circle, Contact } from 'planck';
import type { PoiDefinition, PoiType } from 'shared-types';

export const PIXELS_PER_METER = 64;
export const PLAYER_BODY_RADIUS_M = 20 / PIXELS_PER_METER; // 20px
export const ENEMY_BODY_RADIUS_M  = 24 / PIXELS_PER_METER; // 24px

export function toMeters(pixels: number): number {
  return pixels / PIXELS_PER_METER;
}

export function toPixels(meters: number): number {
  return meters * PIXELS_PER_METER;
}

// Tagged union stored as body userData — lets contact listeners identify bodies without a lookup map
export type PhysicsBodyData =
  | { type: 'player';  playerId: string }
  | { type: 'poi';     poiId: string; poiType: PoiType }
  | { type: 'enemy';   enemyId: string }
  | { type: 'essence'; dropId: string }
  | { type: 'boss';    bossId: string };

export function createPhysicsWorld(): World {
  return new World({ gravity: Vec2(0, 0) });
}

export function createPlayerBody(world: World, playerId: string, x: number, y: number): Body {
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(x), toMeters(y)),
    fixedRotation: true,
    linearDamping: 0,
  });
  body.createFixture({ shape: new Circle(PLAYER_BODY_RADIUS_M), density: 1, friction: 0 });
  body.setUserData({ type: 'player', playerId } satisfies PhysicsBodyData);
  return body;
}

export function createEnemyBody(world: World, enemyId: string, x: number, y: number): Body {
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(x), toMeters(y)),
    fixedRotation: true,
    linearDamping: 0,
  });
  body.createFixture({ shape: new Circle(ENEMY_BODY_RADIUS_M), density: 1, friction: 0 });
  body.setUserData({ type: 'enemy', enemyId } satisfies PhysicsBodyData);
  return body;
}

export function createPoiSensorBody(world: World, poi: PoiDefinition): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(toMeters(poi.x), toMeters(poi.y)),
  });
  body.createFixture({
    shape: new Circle(toMeters(poi.radius)),
    isSensor: true,
  });
  body.setUserData({ type: 'poi', poiId: poi.id, poiType: poi.type } satisfies PhysicsBodyData);
  return body;
}

export function createEssenceSensorBody(world: World, dropId: string, x: number, y: number): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(toMeters(x), toMeters(y)),
  });
  body.createFixture({ shape: new Circle(toMeters(50)), isSensor: true });
  body.setUserData({ type: 'essence', dropId } satisfies PhysicsBodyData);
  return body;
}

export interface EssenceBeginContactEvent {
  playerId: string;
  dropId: string;
}

export function extractEssenceBeginContact(contact: Contact): EssenceBeginContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData  = dataA?.type === 'player'  ? dataA : dataB?.type === 'player'  ? dataB : null;
  const essenceData = dataA?.type === 'essence' ? dataA : dataB?.type === 'essence' ? dataB : null;
  if (!playerData || !essenceData) return null;
  return { playerId: playerData.playerId, dropId: essenceData.dropId };
}

export interface PoiBeginContactEvent {
  playerId: string;
  poiId: string;
  poiType: PoiType;
}

export interface PoiEndContactEvent {
  playerId: string;
  poiId: string;
}

export function extractPoiBeginContact(contact: Contact): PoiBeginContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData = dataA?.type === 'player' ? dataA : dataB?.type === 'player' ? dataB : null;
  const poiData   = dataA?.type === 'poi'    ? dataA : dataB?.type === 'poi'    ? dataB : null;
  if (!playerData || !poiData) return null;
  return { playerId: playerData.playerId, poiId: poiData.poiId, poiType: poiData.poiType };
}

export function extractPoiEndContact(contact: Contact): PoiEndContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData = dataA?.type === 'player' ? dataA : dataB?.type === 'player' ? dataB : null;
  const poiData   = dataA?.type === 'poi'    ? dataA : dataB?.type === 'poi'    ? dataB : null;
  if (!playerData || !poiData) return null;
  return { playerId: playerData.playerId, poiId: poiData.poiId };
}

export function createVictoryTriggerBody(world: World, x: number, y: number, radiusPx: number): Body {
  const body = world.createBody({ type: 'static', position: Vec2(toMeters(x), toMeters(y)) });
  body.createFixture({ shape: new Circle(toMeters(radiusPx)), isSensor: true });
  // No userData needed — GameRoom identifies this body by reference
  return body;
}

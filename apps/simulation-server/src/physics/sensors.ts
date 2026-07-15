import type { Body, Fixture, Contact } from 'planck';
import { Circle } from 'planck';
import type { PhysicsBodyData } from './world.js';
import { CAT_BOND_SENSOR, CAT_PLAYER } from './world.js';

export interface ProjectileEnemyContactEvent {
  projectileId: string;
  enemyId: string;
}

/** Whole-body sensor contact — both bodies carry their own PhysicsBodyData, no fixture-level tag needed. */
export function extractProjectileEnemyContact(contact: Contact): ProjectileEnemyContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const projectileData = dataA?.type === 'projectile' ? dataA : dataB?.type === 'projectile' ? dataB : null;
  const enemyData = dataA?.type === 'enemy' ? dataA : dataB?.type === 'enemy' ? dataB : null;
  if (!projectileData || !enemyData) return null;
  return { projectileId: projectileData.projectileId, enemyId: enemyData.enemyId };
}

export interface ZoneContactEvent {
  zoneId: string;
  targetId: string;
  targetType: 'enemy' | 'player';
}

export function extractZoneContact(contact: Contact): ZoneContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const zoneData = dataA?.type === 'zone' ? dataA : dataB?.type === 'zone' ? dataB : null;
  if (!zoneData) return null;
  const otherData = dataA?.type === 'zone' ? dataB : dataA;
  if (otherData?.type === 'enemy') return { zoneId: zoneData.zoneId, targetId: otherData.enemyId, targetType: 'enemy' };
  if (otherData?.type === 'player') return { zoneId: zoneData.zoneId, targetId: otherData.playerId, targetType: 'player' };
  return null;
}

/** Stored as fixture.getUserData() on bond sensor fixtures. */
export interface BondSensorFixtureData {
  type: 'bond-sensor';
  bondKey: string;        // "${playerA}+${playerB}" — matches bondKey() in game-rules
  targetPlayerId: string; // the OTHER player in the bond (not the one this fixture is on)
}

export interface BondProximityEvent {
  bondKey: string;
}

/**
 * Adds a proximity sensor fixture to an existing player body.
 * The sensor fires contact events when the target player's body enters/exits range.
 * Called by story 5.4 when a bond is assigned; stored in GameRoom.bondSensorFixtures.
 */
export function createBondSensor(
  playerBody: Body,
  rangeM: number,
  bondKey: string,
  targetPlayerId: string,
): Fixture {
  const fixture = playerBody.createFixture({
    shape: new Circle(rangeM),
    isSensor: true,
    filterCategoryBits: CAT_BOND_SENSOR,
    filterMaskBits: CAT_PLAYER,
  });
  fixture.setUserData({ type: 'bond-sensor', bondKey, targetPlayerId } satisfies BondSensorFixtureData);
  return fixture;
}

/**
 * Extracts a bond proximity event from a planck contact if one fixture is a bond sensor
 * and the other fixture's body is the target player.
 * Returns null for any other contact pair.
 */
export function extractBondSensorContact(contact: Contact): BondProximityEvent | null {
  const fixtureA = contact.getFixtureA();
  const fixtureB = contact.getFixtureB();

  const dataA = fixtureA.getUserData() as BondSensorFixtureData | null;
  const dataB = fixtureB.getUserData() as BondSensorFixtureData | null;

  // Sensor-vs-sensor contacts fire at combined radius (double range) — reject them
  if (dataA?.type === 'bond-sensor' && dataB?.type === 'bond-sensor') return null;

  // Identify which fixture is the bond sensor
  const sensorData = dataA?.type === 'bond-sensor' ? dataA
    : dataB?.type === 'bond-sensor' ? dataB
    : null;
  if (!sensorData) return null;

  // Identify the other fixture's body
  const otherFixture = dataA?.type === 'bond-sensor' ? fixtureB : fixtureA;
  const otherBodyData = otherFixture.getBody().getUserData() as PhysicsBodyData | null;

  // Verify it's the intended target player
  if (otherBodyData?.type !== 'player' || otherBodyData.playerId !== sensorData.targetPlayerId) return null;

  return { bondKey: sensorData.bondKey };
}

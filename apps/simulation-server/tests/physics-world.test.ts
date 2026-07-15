import { describe, it, expect } from 'vitest';
import { Vec2, Contact } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody,
  extractPoiBeginContact, extractPoiEndContact, toMeters, toPixels,
  PIXELS_PER_METER, createEnemyBody, createProjectileBody, createZoneBody,
} from '../src/physics/world.js';
import { extractProjectileEnemyContact, extractZoneContact } from '../src/physics/sensors.js';
import { PoiType } from 'shared-types';
import type { PoiDefinition } from 'shared-types';

const TEST_POI: PoiDefinition = {
  id: 'test-poi',
  x: 400,
  y: 540,
  radius: 120,
  type: PoiType.CLASS_SELECT,
};

describe('physics/world', () => {
  it('toMeters / toPixels round-trip', () => {
    expect(toMeters(toPixels(5))).toBeCloseTo(5, 5);
    expect(toPixels(toMeters(320))).toBeCloseTo(320, 5);
  });

  it('PIXELS_PER_METER is 64', () => {
    expect(PIXELS_PER_METER).toBe(64);
  });

  describe('sensor contact detection', () => {
    it('begin-contact fires when player body overlaps POI sensor', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);

      // Place player body inside the POI radius
      createPlayerBody(world, 'p1', TEST_POI.x, TEST_POI.y);

      const events: Array<ReturnType<typeof extractPoiBeginContact>> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractPoiBeginContact(contact));
      });

      world.step(1 / 30, 8, 3);

      const hit = events.find(e => e?.playerId === 'p1');
      expect(hit).toBeDefined();
      expect(hit?.poiId).toBe('test-poi');
      expect(hit?.poiType).toBe(PoiType.CLASS_SELECT);
    });

    it('end-contact fires when player body leaves POI sensor', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);
      const playerBody = createPlayerBody(world, 'p1', TEST_POI.x, TEST_POI.y);

      // First step — player inside POI
      world.step(1 / 30, 8, 3);

      // Move player far away and stop
      playerBody.setPosition(Vec2(toMeters(0), toMeters(0)));
      playerBody.setLinearVelocity(Vec2(0, 0));

      const endEvents: Array<ReturnType<typeof extractPoiEndContact>> = [];
      world.on('end-contact', (contact: Contact) => {
        endEvents.push(extractPoiEndContact(contact));
      });

      world.step(1 / 30, 8, 3);

      expect(endEvents.some(e => e?.playerId === 'p1')).toBe(true);
    });

    it('no contact fires when player is outside POI radius', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);
      // Place player far from POI
      createPlayerBody(world, 'p1', TEST_POI.x + 500, TEST_POI.y + 500);

      const events: Array<unknown> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractPoiBeginContact(contact));
      });

      world.step(1 / 30, 8, 3);

      expect(events.filter(Boolean)).toHaveLength(0);
    });
  });

  describe('projectile physics', () => {
    it('travels along the given direction at the given speed', () => {
      const world = createPhysicsWorld();
      const body = createProjectileBody(world, 'proj-1', 0, 0, 1, 0, 600);

      world.step(1 / 30, 8, 3);

      const pos = body.getPosition();
      expect(toPixels(pos.x)).toBeCloseTo(600 / 30, 0);
      expect(toPixels(pos.y)).toBeCloseTo(0, 5);
    });

    // Regression test for the filter-bit fix in createEnemyBody (Story 3.13):
    // createEnemyBody previously set filterMaskBits: 0, meaning NO contact would
    // ever fire against an enemy — a projectile would silently never hit anything.
    it('begin-contact fires when a projectile travels into an enemy body', () => {
      const world = createPhysicsWorld();
      createEnemyBody(world, 'enemy-1', 100, 0);
      createProjectileBody(world, 'proj-1', 0, 0, 1, 0, 600);

      const events: Array<ReturnType<typeof extractProjectileEnemyContact>> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractProjectileEnemyContact(contact));
      });

      // 600px/s over several 30hz steps covers the 100px gap between spawn and enemy
      for (let i = 0; i < 10; i++) world.step(1 / 30, 8, 3);

      const hit = events.find(e => e?.projectileId === 'proj-1');
      expect(hit).toBeDefined();
      expect(hit?.enemyId).toBe('enemy-1');
    });

    it('does not contact a player body (projectile mask is CAT_ENEMY only)', () => {
      const world = createPhysicsWorld();
      createPlayerBody(world, 'p1', 100, 0);
      createProjectileBody(world, 'proj-1', 0, 0, 1, 0, 600);

      const events: Array<unknown> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractProjectileEnemyContact(contact));
      });

      for (let i = 0; i < 10; i++) world.step(1 / 30, 8, 3);

      expect(events.filter(Boolean)).toHaveLength(0);
    });
  });

  describe('zone physics', () => {
    it('begin-contact fires when an enemy body overlaps a zone sensor', () => {
      const world = createPhysicsWorld();
      createZoneBody(world, 'zone-1', 400, 400, 150);
      createEnemyBody(world, 'enemy-1', 400, 400);

      const events: Array<ReturnType<typeof extractZoneContact>> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractZoneContact(contact));
      });

      world.step(1 / 30, 8, 3);

      const hit = events.find(e => e?.zoneId === 'zone-1');
      expect(hit).toBeDefined();
      expect(hit?.targetId).toBe('enemy-1');
      expect(hit?.targetType).toBe('enemy');
    });

    it('begin-contact fires when a player body overlaps a zone sensor', () => {
      const world = createPhysicsWorld();
      createZoneBody(world, 'zone-1', 400, 400, 150);
      createPlayerBody(world, 'p1', 400, 400);

      const events: Array<ReturnType<typeof extractZoneContact>> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractZoneContact(contact));
      });

      world.step(1 / 30, 8, 3);

      const hit = events.find(e => e?.zoneId === 'zone-1');
      expect(hit).toBeDefined();
      expect(hit?.targetId).toBe('p1');
      expect(hit?.targetType).toBe('player');
    });
  });
});

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
import { PlayerClass } from 'shared-types';
import {
  ABILITY_HIT_RANGE_PX,
  ABILITY_HIT_RADIUS_PX,
  STORM_EYE_ZONE_RADIUS_PX,
  STORM_EYE_TICK_MS,
} from 'game-rules';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta } from '../helpers/messages.js';

const raceTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms)
  )]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Must match GameRoom.ts's tick loop `SPEED` constant (pixels/second in virtual
// 1920x1080 space) — not exported, since it's private to the tick loop.
const PLAYER_SPEED_PX_S = 200;

// Live x/y for every player/enemy id seen so far, refreshed by 'player:moved'/
// 'enemy:moved' deltas — needed because enemy spawn position is per-run RNG and
// enemies chase once a caster gets close, so a single snapshot read goes stale.
function trackPositions(host: Room): { positions: Map<string, { x: number; y: number }>; stop: () => void } {
  const positions = new Map<string, { x: number; y: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsub = host.onMessage(EventNames.DELTA, (d: any) => {
    if (d.type === 'player:moved') positions.set(d.playerId, { x: d.x, y: d.y });
    if (d.type === 'enemy:moved') positions.set(d.enemyId, { x: d.x, y: d.y });
  });
  return { positions, stop: unsub };
}

// Single timed joystick burst covering most of the distance to (toX,toY), stopping
// `stopShortPx` short of it. A long-running closed poll loop (resend every ~50-100ms
// for 10s+) proved unreliable under this harness's WSL2 websocket timing over many
// consecutive sends — one burst sized from the known move speed covers the bulk of
// a long approach in a single round trip.
async function moveTowardPoint(
  mover: Room,
  fromX: number, fromY: number,
  toX: number, toY: number,
  stopShortPx: number,
): Promise<void> {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const travelPx = Math.max(0, dist - stopShortPx);
  if (travelPx === 0) return;
  const mag = dist || 1;
  mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: dx / mag, y: dy / mag } } });
  await sleep((travelPx / PLAYER_SPEED_PX_S) * 1000);
  mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });
  await sleep(300); // let velocity settle to zero and the final player:moved delta arrive
}

// Short closed-loop fine-tune pass — only used once the coarse timed burst above has
// already closed most of the distance, so this only needs a handful of iterations
// (unlike a long-distance closed loop, which proved unreliable — see moveTowardPoint).
async function fineTuneToDistanceBand(
  mover: Room,
  positions: Map<string, { x: number; y: number }>,
  selfId: string,
  targetId: string,
  minDist: number,
  maxDist: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const self = positions.get(selfId);
    const target = positions.get(targetId);
    if (self && target) {
      const dx = target.x - self.x;
      const dy = target.y - self.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist && dist <= maxDist) {
        mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });
        await sleep(200);
        return;
      }
      const sign = dist > maxDist ? 1 : -1; // too far → approach, too close → retreat
      const mag = dist || 1; // guard exact-overlap (dist=0) from producing a NaN joystick vector
      mover.send(EventNames.INPUT, {
        type: 'input',
        event: { type: 'joystick', joystick: { x: sign * (dx / mag), y: sign * (dy / mag) } },
      });
    }
    await sleep(150);
  }
  throw new Error(`fineTuneToDistanceBand: never reached [${minDist},${maxDist}] from ${targetId} within ${timeoutMs}ms`);
}

// classIds[i] corresponds to players[i] (by join order) — classes must be
// selected before any navigation: GameRoom.ts's movement tick zeroes velocity
// for any player whose class is still null, so an unclassed player never moves.
async function setupDungeonRun(client: Colyseus.Client, playerNames: string[], classIds: string[]): Promise<{
  host: Room;
  players: Room[];
  dungeonSnap: SnapshotMsg;
}> {
  const host = await client.create('game_room', { isHost: true });
  const roomId = host.roomId;

  const allJoinedSnap = new Promise<SnapshotMsg>((resolve) => {
    const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
      if (snap.state.players.length >= playerNames.length) { unsub(); resolve(snap); }
    });
  });
  const players = await Promise.all(playerNames.map((name) => client.joinById(roomId, { playerName: name })));
  await raceTimeout(allJoinedSnap, 10_000, 'all players joined');

  const classUpdates = Promise.all(
    players.map((p, i) => waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p.sessionId && d.class === classIds[i])),
  );
  players.forEach((p, i) => p.send(EventNames.CLASS_SELECT, { classId: classIds[i] }));
  await classUpdates;

  // p1 (the first player) navigates to the dungeon entrance — same pattern as full-run.test.ts.
  const [p1] = players;
  const poiEntered = waitForDelta<any>(p1!, (d) => d.type === 'player:poi-entered' && d.poiId === 'dungeon-entrance', 8_000);
  p1!.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: -1.0 } } });
  await poiEntered;
  p1!.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });

  const runProposed = waitForDelta<any>(host, (d) => d.type === 'run:proposed', 5_000);
  p1!.send(EventNames.RUN_PROPOSE, { biome: 'grassland', difficulty: 'easy' });
  await runProposed;

  const dungeonSnapP = new Promise<SnapshotMsg>((resolve) => {
    const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
      if (snap.state.session.phase === 'dungeon') { unsub(); resolve(snap); }
    });
  });
  const runStarting = waitForDelta<any>(host, (d) => d.type === 'run:starting', 5_000);
  for (const p of players) p.send(EventNames.VOTE, { accept: true });
  await runStarting;
  const dungeonSnap = await raceTimeout(dungeonSnapP, 10_000, 'dungeon phase snapshot');

  return { host, players, dungeonSnap };
}

describe('live-room ability dispatch', { timeout: 120_000 }, () => {
  let client: Colyseus.Client;

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  // AC1 (closes D-3.16-A, D-3.17-B, D-3.17-C): Ancestor's Voice is a mixed-faction
  // hit-scan — one cast must damage a live enemy through GameRoom's enemy loop AND
  // heal a live ally through gatherPlayersInHitZone/resolveMixedFactionTargets, both
  // via the real dispatch path (EventNames.INPUT), not the pure game-rules functions
  // directly. Ally is kept healthy (not downed): gatherPlayersInHitZone explicitly
  // excludes isDown players (GameRoom.ts ~line 1105), so a downed ally could never
  // receive this heal — testing a healthy ally is the only reachable case, matching
  // the story's Dev Notes fallback.
  it('Ancestor\'s Voice damages a live enemy and heals a live ally through the real dispatch path (AC1)', async () => {
    const { host, players, dungeonSnap } = await setupDungeonRun(client, ['Caster', 'Ally'], ['spiritcaller', 'spiritcaller']);
    const [caster, ally] = players;

    const enemy = dungeonSnap.state.enemies.find((e: any) => e.isAlive);
    expect(enemy).toBeDefined();
    const enemyHpBefore = enemy!.hp;
    const enemyStart = { x: enemy!.x, y: enemy!.y };
    const casterStart = dungeonSnap.state.players.find((p: any) => p.id === caster!.sessionId)!;
    const allyStart = dungeonSnap.state.players.find((p: any) => p.id === ally!.sessionId)!;

    const { positions, stop } = trackPositions(host);
    positions.set(caster!.sessionId, casterStart);
    positions.set(ally!.sessionId, allyStart);
    positions.set(enemy!.id, enemyStart);

    const hitRange = ABILITY_HIT_RANGE_PX[PlayerClass.SPIRITCALLER][0]; // 180
    const hitRadius = ABILITY_HIT_RADIUS_PX[PlayerClass.SPIRITCALLER][0]; // 50
    const band = hitRadius - 10; // safety margin inside the true hit-radius tolerance

    // Ally: stop well inside the enemy's hit circle.
    await moveTowardPoint(ally!, allyStart.x, allyStart.y, enemyStart.x, enemyStart.y, band / 2);
    await fineTuneToDistanceBand(ally!, positions, ally!.sessionId, enemy!.id, 0, band, 8_000);
    // Caster: stop ~hitRange from the enemy so aiming straight at it centers the hit circle there.
    await moveTowardPoint(caster!, casterStart.x, casterStart.y, enemyStart.x, enemyStart.y, hitRange);
    await fineTuneToDistanceBand(caster!, positions, caster!.sessionId, enemy!.id, hitRange - band, hitRange + band, 8_000);

    const casterPos = positions.get(caster!.sessionId)!;
    const enemyPos = positions.get(enemy!.id)!;
    const dirX = enemyPos.x - casterPos.x;
    const dirY = enemyPos.y - casterPos.y;

    const enemyDamaged = waitForDelta<any>(host, (d) => d.type === 'enemy:damaged' && d.enemyId === enemy!.id, 5_000);
    // Only 'player:hp-updated' can fire here: Ancestor's Voice has no ABILITY_STATUS_EFFECT
    // entry (balance.ts), so a 'status:applied' match would only ever come from something
    // else. Assert hp didn't decrease to rule out an incidental enemy-melee-damage delta
    // (same event type) landing on the ally within the wait window instead of the heal.
    const allyHealed = waitForDelta<any>(
      host,
      (d) => d.type === 'player:hp-updated' && d.playerId === ally!.sessionId,
      5_000,
    );
    caster!.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 0, directionX: dirX, directionY: dirY } },
    });

    const [dmg, heal] = await Promise.all([enemyDamaged, allyHealed]);
    expect(dmg.enemyId).toBe(enemy!.id);
    expect(dmg.remainingHp).toBeLessThan(enemyHpBefore);
    expect(heal.hp).toBeGreaterThanOrEqual(allyStart.hp);

    stop();
    await Promise.all([host.leave(), caster!.leave(), ally!.leave()]);
  });

  // AC2 (closes D-3.20-A): Storm Eye places a live ZoneState; the enemy must take
  // damage on the zone's own tick cadence (through GameRoom's tick loop's zone-tick
  // branch), not via the ability's cast-time hit-scan (zone delivery never resolves
  // damage on cast — see GameRoom.ts's 'zone' delivery branch).
  it('Storm Eye zone-tick damages a live enemy through the live tick loop (AC2)', async () => {
    const { host, players, dungeonSnap } = await setupDungeonRun(client, ['Caster'], ['stormcaller']);
    const [caster] = players;

    const enemy = dungeonSnap.state.enemies.find((e: any) => e.isAlive);
    expect(enemy).toBeDefined();
    const enemyHpBefore = enemy!.hp;
    const enemyStart = { x: enemy!.x, y: enemy!.y };
    const casterStart = dungeonSnap.state.players.find((p: any) => p.id === caster!.sessionId)!;

    const { positions, stop } = trackPositions(host);
    positions.set(caster!.sessionId, casterStart);
    positions.set(enemy!.id, enemyStart);

    const hitRange = ABILITY_HIT_RANGE_PX[PlayerClass.STORMCALLER][3]; // 160
    // Zone radius is large (150px) relative to hitRange (160px), so the caster just
    // needs to be roughly hitRange away from the enemy — a wide, forgiving band.
    const band = STORM_EYE_ZONE_RADIUS_PX - 20;
    await moveTowardPoint(caster!, casterStart.x, casterStart.y, enemyStart.x, enemyStart.y, hitRange);
    await fineTuneToDistanceBand(
      caster!, positions, caster!.sessionId, enemy!.id,
      Math.max(0, hitRange - band), hitRange + band,
      8_000,
    );

    const casterPos = positions.get(caster!.sessionId)!;
    const enemyPos = positions.get(enemy!.id)!;
    const dirX = enemyPos.x - casterPos.x;
    const dirY = enemyPos.y - casterPos.y;

    caster!.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 3, directionX: dirX, directionY: dirY } },
    });

    // Zone ticks every STORM_EYE_TICK_MS once the enemy is inside it; wait past one
    // full cadence (plus slack for the enemy's contact-begin to register) for the tick
    // damage, not the cast itself (zone delivery applies no damage on cast).
    const zoneDamage = await waitForDelta<any>(
      host,
      (d) => d.type === 'enemy:damaged' && d.enemyId === enemy!.id,
      STORM_EYE_TICK_MS + 4_000,
    );
    expect(zoneDamage.remainingHp).toBeLessThan(enemyHpBefore);

    stop();
    await Promise.all([host.leave(), caster!.leave()]);
  });
});

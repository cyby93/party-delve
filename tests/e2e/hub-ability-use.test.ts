import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg, CooldownUpdateMsg } from 'net-protocol';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta, waitForMessage } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

// Story 2.8 (AC1): the ability-processing guard previously required
// `player.nearPoiId === 'training-dummy'` outside a dungeon; firing anywhere
// else in the hub was silently dropped server-side with zero feedback. This
// proves the fix: a player who never navigates toward any POI (still at
// spawn, `nearPoiId === null`, session phase 'lobby') can fire an ability and
// receive a real COOLDOWN_UPDATE — the exact message the old guard prevented.
describe('live-room hub ability use (Story 2.8)', { timeout: 60_000 }, () => {
  let client: Colyseus.Client;

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  it('fires an ability from spawn, away from every POI, without entering a dungeon (AC1)', async () => {
    const host = await client.create('game_room', { isHost: true });
    const roomId = host.roomId;

    const joinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 1) { unsub(); resolve(snap); }
      });
    });
    const player: Room = await client.joinById(roomId, { playerName: 'Solo' });
    const snap = await raceTimeout(joinedSnap, 10_000, 'player joined');

    expect(snap.state.session.phase).toBe('lobby');
    const self = snap.state.players.find((p: any) => p.id === player.sessionId);
    expect(self?.nearPoiId).toBeNull();

    const classUpdated = waitForDelta<any>(
      host,
      (d) => d.type === 'player:class-updated' && d.playerId === player.sessionId && d.class === 'stormcaller',
    );
    player.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    await classUpdated;

    // Thunder Clap (Stormcaller ability index 2) — TAP, no direction needed.
    const cooldownUpdate = waitForMessage<CooldownUpdateMsg>(player, EventNames.COOLDOWN_UPDATE);
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 2, directionX: 0, directionY: 0 } },
    });

    const update = await raceTimeout(cooldownUpdate, 5_000, 'COOLDOWN_UPDATE after hub ability fire');
    expect(update.abilityIndex).toBe(2);
    expect(update.remainingMs).toBeGreaterThan(0);

    await Promise.all([host.leave(), player.leave()]);
  });
});
